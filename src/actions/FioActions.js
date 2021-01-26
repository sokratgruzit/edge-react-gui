// @flow

import type { EdgeCurrencyWallet, EdgeTransaction } from 'edge-core-js'

import * as Constants from '../constants/indexConstants'
import { FIO_WALLET_TYPE } from '../constants/WalletAndCurrencyConstants'
import { addToFioAddressCache, refreshConnectedWalletsForFioAddress } from '../modules/FioAddress/util.js'
import type { Dispatch, GetState } from '../types/reduxTypes.js'

export const refreshConnectedWallets = async (dispatch: Dispatch, getState: GetState, currencyWallets: { [walletId: string]: EdgeCurrencyWallet }) => {
  const wallets: EdgeCurrencyWallet[] = []
  const fioWallets: EdgeCurrencyWallet[] = []
  for (const walletId of Object.keys(currencyWallets)) {
    if (currencyWallets[walletId] && currencyWallets[walletId].type === FIO_WALLET_TYPE) {
      fioWallets.push(currencyWallets[walletId])
    }
    wallets.push(currencyWallets[walletId])
  }
  const connectedWalletsByFioAddress = {}
  for (const fioWallet: EdgeCurrencyWallet of fioWallets) {
    if (!getState().core.account.id) break
    const fioAddresses = await fioWallet.otherMethods.getFioAddressNames()
    for (const fioAddress: string of fioAddresses) {
      if (!getState().core.account.id) break
      connectedWalletsByFioAddress[fioAddress] = await refreshConnectedWalletsForFioAddress(fioAddress, fioWallet, wallets)
      dispatch({
        type: 'FIO/UPDATE_CONNECTED_WALLETS_FOR_FIO_ADDRESS',
        data: {
          fioAddress,
          ccWalletMap: connectedWalletsByFioAddress[fioAddress]
        }
      })
    }
  }
}

export const checkFioObtData = (walletId: string, transactions: EdgeTransaction[]) => async (dispatch: Dispatch, getState: GetState) => {
  const state = getState()
  const { account } = state.core
  if (!account || !account.currencyConfig) {
    setTimeout(() => {
      dispatch(checkFioObtData(walletId, transactions))
    }, 400)
  }
  try {
    const fioPlugin = account.currencyConfig[Constants.CURRENCY_PLUGIN_NAMES.FIO]

    for (const transaction: EdgeTransaction of transactions) {
      if (transaction.metadata) {
        const { name } = transaction.metadata
        if (name && (await fioPlugin.otherMethods.isFioAddressValid(name))) {
          addToFioAddressCache(state.core.account, [name])
        }
      }
    }
  } catch (e) {
    console.log(e)
  }
}
