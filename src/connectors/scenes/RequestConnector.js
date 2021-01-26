// @flow

import type { EdgeCurrencyInfo, EdgeCurrencyWallet } from 'edge-core-js'
import { connect } from 'react-redux'

import { refreshReceiveAddressRequest } from '../../actions/WalletActions'
import type { RequestDispatchProps, RequestLoadingProps, RequestStateProps } from '../../components/scenes/RequestScene'
import { Request } from '../../components/scenes/RequestScene'
import { refreshAllFioAddresses } from '../../modules/FioAddress/action'
import * as SETTINGS_SELECTORS from '../../modules/Settings/selectors.js'
import * as UI_SELECTORS from '../../modules/UI/selectors.js'
import { type Dispatch, type RootState } from '../../types/reduxTypes.js'
import type { GuiCurrencyInfo, GuiDenomination, GuiWallet } from '../../types/types.js'
import { getCurrencyInfo, getDenomFromIsoCode } from '../../util/utils'

const mapStateToProps = (state: RootState): RequestStateProps | RequestLoadingProps => {
  const { account } = state.core
  const { currencyWallets = {} } = account
  const guiWallet: GuiWallet = UI_SELECTORS.getSelectedWallet(state)
  const currencyCode: string = UI_SELECTORS.getSelectedCurrencyCode(state)

  const plugins: Object = SETTINGS_SELECTORS.getPlugins(state)
  const allCurrencyInfos: EdgeCurrencyInfo[] = plugins.allCurrencyInfos
  const currencyInfo: EdgeCurrencyInfo | void = getCurrencyInfo(allCurrencyInfos, currencyCode)

  if (!guiWallet || !currencyCode) {
    return {
      currencyCode: null,
      currencyInfo: null,
      edgeWallet: null,
      exchangeSecondaryToPrimaryRatio: null,
      guiWallet: null,
      loading: true,
      primaryCurrencyInfo: null,
      secondaryCurrencyInfo: null,
      publicAddress: '',
      legacyAddress: '',
      useLegacyAddress: null,
      fioAddressesExist: false,
      isConnected: state.network.isConnected
    }
  }

  const edgeWallet: EdgeCurrencyWallet = currencyWallets[guiWallet.id]
  const primaryDisplayDenomination: GuiDenomination = SETTINGS_SELECTORS.getDisplayDenomination(state, currencyCode)
  const primaryExchangeDenomination: GuiDenomination = UI_SELECTORS.getExchangeDenomination(state, currencyCode)
  const secondaryExchangeDenomination: GuiDenomination = getDenomFromIsoCode(guiWallet.fiatCurrencyCode)
  const secondaryDisplayDenomination: GuiDenomination = secondaryExchangeDenomination
  const primaryExchangeCurrencyCode: string = primaryExchangeDenomination.name
  const secondaryExchangeCurrencyCode: string = secondaryExchangeDenomination.name ? secondaryExchangeDenomination.name : ''

  const primaryCurrencyInfo: GuiCurrencyInfo = {
    displayCurrencyCode: currencyCode,
    displayDenomination: primaryDisplayDenomination,
    exchangeCurrencyCode: primaryExchangeCurrencyCode,
    exchangeDenomination: primaryExchangeDenomination
  }
  const secondaryCurrencyInfo: GuiCurrencyInfo = {
    displayCurrencyCode: guiWallet.fiatCurrencyCode,
    displayDenomination: secondaryDisplayDenomination,
    exchangeCurrencyCode: secondaryExchangeCurrencyCode,
    exchangeDenomination: secondaryExchangeDenomination
  }
  const isoFiatCurrencyCode: string = guiWallet.isoFiatCurrencyCode
  const exchangeSecondaryToPrimaryRatio = UI_SELECTORS.getExchangeRate(state, currencyCode, isoFiatCurrencyCode)
  const fioAddressesExist = !!state.ui.scenes.fioAddress.fioAddresses.length
  return {
    currencyCode,
    currencyInfo: currencyInfo || null,
    edgeWallet,
    exchangeSecondaryToPrimaryRatio,
    guiWallet,
    publicAddress: guiWallet.receiveAddress.publicAddress || '',
    legacyAddress: guiWallet.receiveAddress.legacyAddress || '',
    loading: false,
    primaryCurrencyInfo,
    secondaryCurrencyInfo,
    useLegacyAddress: state.ui.scenes.requestType.useLegacyAddress,
    fioAddressesExist,
    isConnected: state.network.isConnected
  }
}
const mapDispatchToProps = (dispatch: Dispatch): RequestDispatchProps => ({
  refreshReceiveAddressRequest: (walletId: string) => {
    dispatch(refreshReceiveAddressRequest(walletId))
  },
  refreshAllFioAddresses: () => dispatch(refreshAllFioAddresses())
})

export default connect(mapStateToProps, mapDispatchToProps)(Request)
