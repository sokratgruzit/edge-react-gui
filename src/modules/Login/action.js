// @flow

import { type EdgeAccount, type EdgeCurrencyInfo } from 'edge-core-js/types'
import { hasSecurityAlerts } from 'edge-login-ui-rn'
import { getCurrencies } from 'react-native-localize'
import { Actions } from 'react-native-router-flux'
import { sprintf } from 'sprintf-js'

import { loadAccountReferral, refreshAccountReferral } from '../../actions/AccountReferralActions.js'
import { trackAccountEvent } from '../../actions/TrackingActions.js'
import { checkEnabledTokensArray, getEnabledTokens, setWalletEnabledTokens } from '../../actions/WalletActions.js'
import { showError } from '../../components/services/AirshipInstance.js'
import * as Constants from '../../constants/indexConstants'
import { SECURITY_ALERTS_SCENE } from '../../constants/indexConstants'
import s from '../../locales/strings.js'
import type { Dispatch, GetState } from '../../types/reduxTypes.js'
import { type CustomTokenInfo, type GuiTouchIdInfo } from '../../types/types.js'
import { runWithTimeout } from '../../util/utils.js'
import {
  getLocalSettings,
  getSyncedSettings,
  LOCAL_ACCOUNT_DEFAULTS,
  LOCAL_ACCOUNT_TYPES,
  PASSWORD_RECOVERY_REMINDERS_SHOWN,
  setLocalSettings,
  setSyncedSettings,
  SYNCED_ACCOUNT_DEFAULTS,
  SYNCED_ACCOUNT_TYPES
} from '../Core/Account/settings.js'
import { updateWalletsEnabledTokens, updateWalletsRequest } from '../Core/Wallets/action.js'
import { attachToUser } from '../Device/action'

function getFirstActiveWalletInfo(account: EdgeAccount): { walletId: string, currencyCode: string } {
  // Find the first wallet:
  const walletId = account.activeWalletIds[0]
  const walletKey = account.allKeys.find(key => key.id === walletId)
  if (!walletKey) {
    throw new Error('Cannot find a walletInfo for the active wallet')
  }

  // Find the matching currency code:
  const currencyCodes = {}
  for (const pluginId of Object.keys(account.currencyConfig)) {
    const { currencyInfo } = account.currencyConfig[pluginId]
    currencyCodes[currencyInfo.walletType] = currencyInfo.currencyCode
  }
  const currencyCode = currencyCodes[walletKey.type]

  return { walletId, currencyCode }
}

export const initializeAccount = (account: EdgeAccount, touchIdInfo: GuiTouchIdInfo) => async (dispatch: Dispatch, getState: GetState) => {
  dispatch({ type: 'LOGIN', data: account })

  Actions[Constants.EDGE]()
  if (hasSecurityAlerts(account)) {
    Actions.push(SECURITY_ALERTS_SCENE)
  }

  const state = getState()
  const { context } = state.core

  dispatch(attachToUser())

  const walletInfos = account.allKeys
  const filteredWalletInfos = walletInfos.map(({ keys, id, ...info }) => info)
  console.log('Wallet Infos:', filteredWalletInfos)

  let accountInitObject = {
    account,
    touchIdInfo,
    walletId: '',
    currencyCode: '',
    autoLogoutTimeInSeconds: 3600,
    bluetoothMode: false,
    pinLoginEnabled: false,
    pinMode: false,
    countryCode: '',
    customTokens: [],
    defaultFiat: '',
    defaultIsoFiat: '',
    merchantMode: '',
    denominationKeys: [],
    customTokensSettings: [],
    activeWalletIds: [],
    archivedWalletIds: [],
    passwordReminder: {},
    isAccountBalanceVisible: false,
    isWalletFiatBalanceVisible: false,
    spendingLimits: {},
    passwordRecoveryRemindersShown: PASSWORD_RECOVERY_REMINDERS_SHOWN
  }
  try {
    let newAccount = false
    let defaultFiat = Constants.USD_FIAT
    if (account.activeWalletIds.length < 1) {
      const [phoneCurrency] = getCurrencies()
      if (typeof phoneCurrency === 'string' && phoneCurrency.length >= 3) {
        defaultFiat = phoneCurrency
      }

      newAccount = true
    } else {
      // We have a wallet
      const { walletId, currencyCode } = getFirstActiveWalletInfo(account)
      accountInitObject.walletId = walletId
      accountInitObject.currencyCode = currencyCode
    }
    const activeWalletIds = account.activeWalletIds
    dispatch({
      type: 'INSERT_WALLET_IDS_FOR_PROGRESS',
      data: { activeWalletIds }
    })
    const archivedWalletIds = account.archivedWalletIds

    accountInitObject.activeWalletIds = activeWalletIds
    accountInitObject.archivedWalletIds = archivedWalletIds

    const loadedSyncedSettings = await getSyncedSettings(account)
    const syncedSettings = { ...loadedSyncedSettings } // will prevent mergeSettings trying to find prop of undefined
    const mergedSyncedSettings = mergeSettings(syncedSettings, SYNCED_ACCOUNT_DEFAULTS, SYNCED_ACCOUNT_TYPES, account)
    if (mergedSyncedSettings.isOverwriteNeeded) {
      setSyncedSettings(account, { ...mergedSyncedSettings.finalSettings })
    }
    accountInitObject = { ...accountInitObject, ...mergedSyncedSettings.finalSettings }

    if (accountInitObject.customTokens) {
      accountInitObject.customTokens.forEach(token => {
        accountInitObject.customTokensSettings.push(token)
        // this second dispatch will be redundant if we set 'denomination' property upon customToken creation
        accountInitObject.denominationKeys.push({ currencyCode: token.currencyCode, denominationKey: token.multiplier })
      })
    }
    for (const key of Object.keys(accountInitObject)) {
      if (accountInitObject[key]) {
        // avoid trying to look at property 'denomination' of undefined
        const typeofDenomination = typeof accountInitObject[key].denomination
        if (typeofDenomination === 'string') {
          accountInitObject.denominationKeys.push({ currencyCode: key, denominationKey: accountInitObject[key].denomination })
        }
      }
    }
    const loadedLocalSettings = await getLocalSettings(account)
    const localSettings = { ...loadedLocalSettings }
    const mergedLocalSettings = mergeSettings(localSettings, LOCAL_ACCOUNT_DEFAULTS, LOCAL_ACCOUNT_TYPES)
    if (mergedLocalSettings.isOverwriteNeeded) {
      setLocalSettings(account, { ...mergedSyncedSettings.finalSettings })
    }
    accountInitObject = { ...accountInitObject, ...mergedLocalSettings.finalSettings }

    accountInitObject.pinLoginEnabled = await context.pinLoginEnabled(account.username)

    if (newAccount) {
      accountInitObject.defaultFiat = defaultFiat
      accountInitObject.defaultIsoFiat = 'iso:' + defaultFiat
    }

    dispatch({
      type: 'ACCOUNT_INIT_COMPLETE',
      data: { ...accountInitObject }
    })

    if (newAccount) {
      // Ensure the creation reason is available before creating wallets:
      await dispatch(loadAccountReferral(account))
      const { currencyCodes } = getState().account.accountReferral
      const fiatCurrencyCode = 'iso:' + defaultFiat
      if (currencyCodes && currencyCodes.length > 0) {
        await createCustomWallets(account, fiatCurrencyCode, currencyCodes, dispatch)
      } else {
        await createDefaultWallets(account, fiatCurrencyCode, dispatch)
      }
      dispatch(refreshAccountReferral())
    } else {
      // Load the creation reason more lazily:
      dispatch(loadAccountReferral(account)).then(() => dispatch(refreshAccountReferral()))
    }

    await updateWalletsRequest()(dispatch, getState)
    for (const wId of activeWalletIds) {
      await getEnabledTokens(wId)(dispatch, getState)
    }
    updateWalletsEnabledTokens(getState)
  } catch (error) {
    showError(error)
  }
}

export const mergeSettings = (
  loadedSettings: Object,
  defaults: Object,
  types: Object,
  account?: Object
): { finalSettings: Object, isOverwriteNeeded: boolean, isDefaultTypeIncorrect: boolean } => {
  const finalSettings = {}
  // begin process for repairing damaged settings data
  let isOverwriteNeeded = false
  let isDefaultTypeIncorrect = false
  for (const key of Object.keys(defaults)) {
    // if the type of the setting default does not meet the enforced type
    const defaultSettingType = typeof defaults[key]
    if (defaultSettingType !== types[key]) {
      isDefaultTypeIncorrect = true
      console.error('MismatchedDefaultSettingType key: ', key, ' with defaultSettingType: ', defaultSettingType, ' and necessary type: ', types[key])
    }

    // if the type of the loaded setting does not meet the enforced type
    // eslint-disable-next-line valid-typeof
    const loadedSettingType = typeof loadedSettings[key]
    if (loadedSettingType !== types[key]) {
      isOverwriteNeeded = true
      console.warn(
        'Settings overwrite was needed for: ',
        key,
        ' with loaded value: ',
        loadedSettings[key],
        ', but needed type: ',
        types[key],
        ' so replace with: ',
        defaults[key]
      )
      // change that erroneous value to something that works (default)
      finalSettings[key] = defaults[key]
    } else {
      finalSettings[key] = loadedSettings[key]
    }

    if (account && loadedSettings[key] != null) {
      const currencyName = Constants.CURRENCY_PLUGIN_NAMES[key]
      const doesHaveDenominations = loadedSettings[key].denominations
      const doesHavePlugin = account.currencyConfig[currencyName]
      // if there are settings for this key
      // and currency (not token) and has a plugin name
      if (loadedSettings && loadedSettings[key] && doesHaveDenominations && doesHavePlugin && currencyName) {
        // for each currency info (each native currency)
        const pluginDenominations = account.currencyConfig[currencyName].currencyInfo.denominations // get denominations for that plugin
        const settingDenominationIndex = pluginDenominations.findIndex(pluginDenom => pluginDenom.multiplier === loadedSettings[key].denomination) // find settings denom in plugin denoms
        if (settingDenominationIndex === -1) {
          // setting denomination is not present in plugin (and on wallet)
          finalSettings[key].denomination = pluginDenominations[0].multiplier // grab the first denom multiplier from plugin
          console.warn(`${key} denomination ${loadedSettings[key].denomination} invalid, overwriting with plugin denom`)
          isOverwriteNeeded = true // make sure synced settings get overwritten
        }
      }
    }
  }

  // Filter conflicting tokens out of synced settings:
  if (finalSettings.customTokens && account != null) {
    const { currencyConfig } = account
    finalSettings.customTokens = finalSettings.customTokens.filter((customToken: CustomTokenInfo) => {
      for (const pluginId of Object.keys(currencyConfig)) {
        const { currencyInfo } = currencyConfig[pluginId]
        if (customToken.currencyCode === currencyInfo.currencyCode) return false
      }
      return true
    })
  }

  return {
    finalSettings,
    isOverwriteNeeded,
    isDefaultTypeIncorrect
  }
}

export const logoutRequest = (username?: string) => (dispatch: Dispatch, getState: GetState) => {
  Actions.popTo(Constants.LOGIN, { username })
  const state = getState()
  const { account } = state.core
  dispatch({ type: 'LOGOUT', data: { username } })
  if (typeof account.logout === 'function') account.logout()
}

/**
 * Finds the currency info for a currency code.
 */
function findCurrencyInfo(account: EdgeAccount, currencyCode: string): EdgeCurrencyInfo | void {
  for (const pluginId of Object.keys(account.currencyConfig)) {
    const { currencyInfo } = account.currencyConfig[pluginId]
    if (currencyInfo.currencyCode.toUpperCase() === currencyCode) {
      return currencyInfo
    }
  }
}

/**
 * Creates a wallet, with timeout, and maybe also activates it.
 */
async function safeCreateWallet(account: EdgeAccount, walletType: string, walletName: string, fiatCurrencyCode: string, dispatch: Dispatch) {
  const wallet = await runWithTimeout(
    account.createCurrencyWallet(walletType, {
      name: walletName,
      fiatCurrencyCode
    }),
    20000,
    new Error(s.strings.error_creating_wallets)
  )
  if (account.activeWalletIds.length <= 1) {
    dispatch({
      type: 'UI/WALLETS/SELECT_WALLET',
      data: { currencyCode: wallet.currencyInfo.currencyCode, walletId: wallet.id }
    })
  }
  return wallet
}

/**
 * Creates the custom default wallets inside a new account.
 */
async function createCustomWallets(account: EdgeAccount, fiatCurrencyCode: string, currencyCodes: string[], dispatch: Dispatch) {
  const currencyInfos = []
  for (const code of currencyCodes) {
    const [parent] = code.split(':')
    if (currencyInfos.find(info => info.currencyCode === parent)) continue
    const currencyInfo = findCurrencyInfo(account, parent)
    if (currencyInfo != null) currencyInfos.push(currencyInfo)
  }

  if (currencyInfos.length === 0) {
    return createDefaultWallets(account, fiatCurrencyCode, dispatch)
  }

  for (const currencyInfo of currencyInfos) {
    const walletName = sprintf(s.strings.my_crypto_wallet_name, currencyInfo.displayName)
    const wallet = await safeCreateWallet(account, currencyInfo.walletType, walletName, fiatCurrencyCode, dispatch)

    const tokenCodes = []
    for (const code of currencyCodes) {
      const [parent, child] = code.split(':')
      if (parent === currencyInfo.currencyCode && child != null) tokenCodes.push(child)
      if (tokenCodes.length > 0) {
        dispatch(setWalletEnabledTokens(wallet.id, tokenCodes, []))
        dispatch(checkEnabledTokensArray(wallet.id, tokenCodes))
      }
    }
  }
}

/**
 * Creates the default wallets inside a new account.
 */
async function createDefaultWallets(account: EdgeAccount, fiatCurrencyCode: string, dispatch: Dispatch) {
  // TODO: Run these in parallel once the Core has safer locking:
  await safeCreateWallet(account, 'wallet:bitcoin', s.strings.string_first_bitcoin_wallet_name, fiatCurrencyCode, dispatch)
  await safeCreateWallet(account, 'wallet:bitcoincash', s.strings.string_first_bitcoincash_wallet_name, fiatCurrencyCode, dispatch)
  await safeCreateWallet(account, 'wallet:ethereum', s.strings.string_first_ethereum_wallet_name, fiatCurrencyCode, dispatch)

  dispatch(trackAccountEvent('SignupWalletsCreated'))
}
