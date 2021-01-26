// @flow

import Clipboard from '@react-native-community/clipboard'
import { bns } from 'biggystring'
import type { EdgeCurrencyInfo, EdgeCurrencyWallet, EdgeEncodeUri } from 'edge-core-js'
import * as React from 'react'
import type { RefObject } from 'react-native'
import { ActivityIndicator, Dimensions, InputAccessoryView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Actions } from 'react-native-router-flux'
import Share from 'react-native-share'
import { sprintf } from 'sprintf-js'

import * as Constants from '../../constants/indexConstants'
import s from '../../locales/strings.js'
import ExchangeRate from '../../modules/UI/components/ExchangeRate/ExchangeRate.ui.js'
import type { ExchangedFlipInputAmounts } from '../../modules/UI/components/FlipInput/ExchangedFlipInput2.js'
import { ExchangedFlipInput } from '../../modules/UI/components/FlipInput/ExchangedFlipInput2.js'
import { RequestStatus } from '../../modules/UI/components/RequestStatus/RequestStatus.ui.js'
import { ShareButtons } from '../../modules/UI/components/ShareButtons/ShareButtons.ui.js'
import { THEME } from '../../theme/variables/airbitz.js'
import type { GuiCurrencyInfo, GuiWallet } from '../../types/types.js'
import { scale } from '../../util/scaling.js'
import { getObjectDiff } from '../../util/utils'
import { QrCode } from '../common/QrCode.js'
import { SceneWrapper } from '../common/SceneWrapper.js'
import { ButtonsModal } from '../modals/ButtonsModal.js'
import { Airship, showError, showToast } from '../services/AirshipInstance.js'

const PUBLIC_ADDRESS_REFRESH_MS = 2000

export type RequestStateProps = {
  currencyCode: string,
  currencyInfo: EdgeCurrencyInfo | null,
  edgeWallet: EdgeCurrencyWallet,
  exchangeSecondaryToPrimaryRatio: number,
  guiWallet: GuiWallet,
  loading: false,
  primaryCurrencyInfo: GuiCurrencyInfo,
  publicAddress: string,
  legacyAddress: string,
  secondaryCurrencyInfo: GuiCurrencyInfo,
  useLegacyAddress: boolean,
  fioAddressesExist: boolean,
  isConnected: boolean
}
export type RequestLoadingProps = {
  edgeWallet: null,
  currencyCode: null,
  currencyInfo: null,
  exchangeSecondaryToPrimaryRatio: null,
  guiWallet: null,
  loading: true,
  primaryCurrencyInfo: null,
  publicAddress: string,
  legacyAddress: string,
  secondaryCurrencyInfo: null,
  useLegacyAddress: null,
  fioAddressesExist: boolean,
  isConnected: boolean
}

export type RequestDispatchProps = {
  refreshReceiveAddressRequest(string): void,
  refreshAllFioAddresses: () => Promise<void>
}
type ModalState = 'NOT_YET_SHOWN' | 'VISIBLE' | 'SHOWN'
type CurrencyMinimumPopupState = { [currencyCode: string]: ModalState }

type LoadingProps = RequestLoadingProps & RequestDispatchProps
type LoadedProps = RequestStateProps & RequestDispatchProps
type Props = LoadingProps | LoadedProps
type State = {
  publicAddress: string,
  legacyAddress: string,
  encodedURI: string,
  minimumPopupModalState: CurrencyMinimumPopupState,
  isFioMode: boolean
}

const inputAccessoryViewID: string = 'cancelHeaderId'

export class Request extends React.Component<Props, State> {
  amounts: ExchangedFlipInputAmounts
  flipInput: RefObject | null = null

  constructor(props: Props) {
    super(props)
    const minimumPopupModalState: CurrencyMinimumPopupState = {}
    Object.keys(Constants.SPECIAL_CURRENCY_INFO).forEach(currencyCode => {
      if (Constants.getSpecialCurrencyInfo(currencyCode).minimumPopupModals) {
        minimumPopupModalState[currencyCode] = 'NOT_YET_SHOWN'
      }
    })
    this.state = {
      publicAddress: props.publicAddress,
      legacyAddress: props.legacyAddress,
      encodedURI: '',
      minimumPopupModalState,
      isFioMode: false
    }
    if (this.shouldShowMinimumModal(props)) {
      if (!props.currencyCode) return
      this.state.minimumPopupModalState[props.currencyCode] = 'VISIBLE'
      console.log('stop, in constructor')
      this.enqueueMinimumAmountModal()
    }
  }

  componentDidMount() {
    this.generateEncodedUri()
    this.props.refreshAllFioAddresses()
  }

  onCloseXRPMinimumModal = () => {
    const minimumPopupModalState: CurrencyMinimumPopupState = Object.assign({}, this.state.minimumPopupModalState)
    if (!this.props.currencyCode) return
    minimumPopupModalState[this.props.currencyCode] = 'SHOWN'
    this.setState({ minimumPopupModalState })
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    let diffElement2: string = ''
    const diffElement = getObjectDiff(this.props, nextProps, {
      primaryCurrencyInfo: true,
      secondaryCurrencyInfo: true,
      displayDenomination: true,
      exchangeDenomination: true
    })
    if (!diffElement) {
      diffElement2 = getObjectDiff(this.state, nextState)
    }
    return !!diffElement || !!diffElement2
  }

  async generateEncodedUri() {
    const { edgeWallet, useLegacyAddress, currencyCode } = this.props
    if (!currencyCode) return
    let { publicAddress, legacyAddress } = this.props
    const abcEncodeUri = {
      publicAddress: useLegacyAddress ? legacyAddress : publicAddress,
      currencyCode
    }
    let encodedURI = s.strings.loading
    try {
      encodedURI = edgeWallet ? await edgeWallet.encodeUri(abcEncodeUri) : s.strings.loading
      this.setState({
        encodedURI
      })
    } catch (e) {
      console.log(e)
      publicAddress = s.strings.loading
      legacyAddress = s.strings.loading
      this.setState({
        publicAddress,
        legacyAddress
      })
      setTimeout(() => {
        if (edgeWallet && edgeWallet.id) {
          this.props.refreshReceiveAddressRequest(edgeWallet.id)
        }
      }, PUBLIC_ADDRESS_REFRESH_MS)
    }
  }

  async UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const { currencyCode } = nextProps
    if (nextProps.loading || currencyCode === null) return

    const didAddressChange = this.state.publicAddress !== nextProps.guiWallet.receiveAddress.publicAddress
    const changeLegacyPublic = nextProps.useLegacyAddress !== this.props.useLegacyAddress
    const didWalletChange = this.props.edgeWallet && nextProps.edgeWallet.id !== this.props.edgeWallet.id

    if (didAddressChange || changeLegacyPublic || didWalletChange) {
      let publicAddress = nextProps.guiWallet.receiveAddress.publicAddress
      let legacyAddress = nextProps.guiWallet.receiveAddress.legacyAddress

      const abcEncodeUri = nextProps.useLegacyAddress ? { publicAddress, legacyAddress, currencyCode } : { publicAddress, currencyCode }
      let encodedURI = s.strings.loading
      try {
        encodedURI = nextProps.edgeWallet ? await nextProps.edgeWallet.encodeUri(abcEncodeUri) : s.strings.loading
      } catch (err) {
        console.log(err)
        publicAddress = s.strings.loading
        legacyAddress = s.strings.loading
        setTimeout(() => {
          if (nextProps.edgeWallet && nextProps.edgeWallet.id) {
            nextProps.refreshReceiveAddressRequest(nextProps.edgeWallet.id)
          }
        }, PUBLIC_ADDRESS_REFRESH_MS)
      }

      this.setState({
        encodedURI,
        publicAddress: publicAddress,
        legacyAddress: legacyAddress
      })
    }
    // old blank address to new
    // include 'didAddressChange' because didWalletChange returns false upon initial request scene load
    if (didWalletChange || didAddressChange) {
      if (this.shouldShowMinimumModal(nextProps)) {
        const minimumPopupModalState: CurrencyMinimumPopupState = Object.assign({}, this.state.minimumPopupModalState)
        if (minimumPopupModalState[nextProps.currencyCode] === 'NOT_YET_SHOWN') {
          this.enqueueMinimumAmountModal()
        }
        minimumPopupModalState[nextProps.currencyCode] = 'VISIBLE'
        this.setState({ minimumPopupModalState })
      }
    }
  }

  enqueueMinimumAmountModal = async () => {
    const { currencyCode } = this.props
    if (currencyCode == null) return
    const { minimumPopupModals } = Constants.getSpecialCurrencyInfo(currencyCode)
    if (minimumPopupModals == null) return

    await Airship.show(bridge => (
      <ButtonsModal
        bridge={bridge}
        title={s.strings.request_minimum_notification_title}
        message={minimumPopupModals.modalMessage}
        buttons={{ ok: { label: s.strings.string_ok } }}
      />
    ))

    // resolve value doesn't really matter here
    this.onCloseXRPMinimumModal()
  }

  onNext = () => {
    if (this.state.isFioMode) {
      this.setState({ isFioMode: false })
      this.fioAddressModal()
    }
  }

  flipInputRef = (ref: RefObject) => {
    this.flipInput = ref && ref.flipInput ? ref.flipInput.current : null
  }

  render() {
    if (this.props.loading) {
      return <ActivityIndicator color={THEME.COLORS.GRAY_2} style={{ flex: 1, alignSelf: 'center' }} size="large" />
    }

    const { primaryCurrencyInfo, secondaryCurrencyInfo, exchangeSecondaryToPrimaryRatio, currencyInfo, guiWallet } = this.props
    const addressExplorer = currencyInfo ? currencyInfo.addressExplorer : null
    const requestAddress = this.props.useLegacyAddress ? this.state.legacyAddress : this.state.publicAddress
    const qrSize = Dimensions.get('window').height / 4
    const flipInputHeaderText = guiWallet ? sprintf(s.strings.send_to_wallet, guiWallet.name) : ''
    const flipInputHeaderLogo = guiWallet.symbolImageDarkMono
    const { keysOnlyMode = false } = Constants.getSpecialCurrencyInfo(primaryCurrencyInfo.displayCurrencyCode)
    return (
      <SceneWrapper background="header" hasTabs={false}>
        <View style={styles.exchangeRateContainer}>
          <ExchangeRate primaryInfo={primaryCurrencyInfo} secondaryInfo={secondaryCurrencyInfo} secondaryDisplayAmount={exchangeSecondaryToPrimaryRatio} />
        </View>

        {keysOnlyMode !== true ? (
          <View style={styles.main}>
            <ExchangedFlipInput
              ref={this.flipInputRef}
              headerText={flipInputHeaderText}
              headerLogo={flipInputHeaderLogo}
              primaryCurrencyInfo={primaryCurrencyInfo}
              secondaryCurrencyInfo={secondaryCurrencyInfo}
              exchangeSecondaryToPrimaryRatio={exchangeSecondaryToPrimaryRatio}
              overridePrimaryExchangeAmount=""
              forceUpdateGuiCounter={0}
              onExchangeAmountChanged={this.onExchangeAmountChanged}
              keyboardVisible={false}
              color={THEME.COLORS.WHITE}
              isFiatOnTop
              isFocus={false}
              onNext={this.onNext}
              topReturnKeyType={this.state.isFioMode ? 'next' : 'done'}
              inputAccessoryViewID={this.state.isFioMode ? inputAccessoryViewID : ''}
            />

            {Platform.OS === 'ios' ? (
              <InputAccessoryView backgroundColor={THEME.COLORS.OPAQUE_WHITE} nativeID={inputAccessoryViewID}>
                <View style={styles.accessoryView}>
                  <TouchableOpacity style={styles.accessoryBtn} onPress={this.cancelFioMode}>
                    <Text style={styles.accessoryText}>{this.state.isFioMode ? s.strings.string_cancel_cap : ''}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.accessoryBtn} onPress={this.nextFioMode}>
                    <Text style={styles.accessoryText}>{this.state.isFioMode ? s.strings.string_next_capitalized : 'Done'}</Text>
                  </TouchableOpacity>
                </View>
              </InputAccessoryView>
            ) : null}

            <View style={styles.qrContainer}>
              <QrCode data={this.state.encodedURI} size={qrSize} />
            </View>
            <RequestStatus requestAddress={requestAddress} addressExplorer={addressExplorer} />
          </View>
        ) : (
          <Text style={styles.text}>{sprintf(s.strings.request_deprecated_currency_code, primaryCurrencyInfo.displayCurrencyCode)}</Text>
        )}

        {keysOnlyMode !== true && (
          <View style={styles.shareButtonsContainer}>
            <ShareButtons shareViaShare={this.shareViaShare} copyToClipboard={this.copyToClipboard} fioAddressModal={this.fioAddressModal} />
          </View>
        )}
      </SceneWrapper>
    )
  }

  onExchangeAmountChanged = async (amounts: ExchangedFlipInputAmounts) => {
    const { publicAddress, legacyAddress } = this.state
    const { currencyCode } = this.props
    this.amounts = amounts
    if (!currencyCode) return
    const edgeEncodeUri: EdgeEncodeUri =
      this.props.useLegacyAddress && legacyAddress ? { publicAddress, legacyAddress, currencyCode } : { publicAddress, currencyCode }
    if (bns.gt(amounts.nativeAmount, '0')) {
      edgeEncodeUri.nativeAmount = amounts.nativeAmount
    }
    let encodedURI = s.strings.loading
    try {
      encodedURI = this.props.edgeWallet ? await this.props.edgeWallet.encodeUri(edgeEncodeUri) : s.strings.loading
    } catch (e) {
      console.log(e)
      setTimeout(() => {
        if (this.props.edgeWallet && this.props.edgeWallet.id) {
          this.props.refreshReceiveAddressRequest(this.props.edgeWallet.id)
        }
      }, PUBLIC_ADDRESS_REFRESH_MS)
    }

    this.setState({ encodedURI })
  }

  copyToClipboard = () => {
    const requestAddress = this.props.useLegacyAddress ? this.state.legacyAddress : this.state.publicAddress
    Clipboard.setString(requestAddress)
    showToast(s.strings.fragment_request_address_copied)
  }

  shouldShowMinimumModal = (props: Props): boolean => {
    if (!props.currencyCode) return false
    if (this.state.minimumPopupModalState[props.currencyCode]) {
      if (this.state.minimumPopupModalState[props.currencyCode] === 'NOT_YET_SHOWN') {
        const { minimumPopupModals } = Constants.getSpecialCurrencyInfo(props.currencyCode)
        const minBalance = minimumPopupModals != null ? minimumPopupModals.minimumNativeBalance : '0'
        if (bns.lt(props.guiWallet.primaryNativeBalance, minBalance)) {
          return true
        }
      }
    }
    return false
  }

  shareMessage = async () => {
    const { currencyCode, publicAddress, edgeWallet } = this.props
    const { legacyAddress } = this.state
    if (!currencyCode || !edgeWallet) {
      throw new Error('Wallet still loading. Please wait and try again.')
    }
    let sharedAddress = this.state.encodedURI
    let edgePayUri = 'https://deep.edge.app/'
    let addOnMessage = ''
    // if encoded (like XTZ), only share the public address
    if (Constants.getSpecialCurrencyInfo(currencyCode).isUriEncodedStructure) {
      sharedAddress = publicAddress
    } else {
      // Rebuild uri to preserve uriPrefix if amount is 0
      if (sharedAddress.indexOf('amount') === -1) {
        const edgeEncodeUri: EdgeEncodeUri =
          this.props.useLegacyAddress && legacyAddress
            ? { publicAddress, legacyAddress, currencyCode, nativeAmount: '0' }
            : { publicAddress, currencyCode, nativeAmount: '0' }
        const newUri = await edgeWallet.encodeUri(edgeEncodeUri)
        sharedAddress = newUri.substring(0, newUri.indexOf('?'))
      }
      edgePayUri = edgePayUri + `pay/${sharedAddress.replace(':', '/')}`
      addOnMessage = `\n\n${sprintf(s.strings.request_qr_email_title, s.strings.app_name_short)}\n\n`
    }

    const message = `${sharedAddress}${addOnMessage}`
    const shareOptions = {
      message: Platform.OS === 'ios' ? message : message + edgePayUri,
      url: Platform.OS === 'ios' ? edgePayUri : ''
    }
    Share.open(shareOptions).catch(e => console.log(e))
  }

  shareViaShare = () => {
    this.shareMessage()
    // console.log('shareViaShare')
  }

  fioAddressModal = async () => {
    if (!this.props.isConnected) {
      showError(s.strings.fio_network_alert_text)
      return
    }
    if (!this.props.fioAddressesExist) {
      showError(`${s.strings.title_register_fio_address}. ${s.strings.fio_request_by_fio_address_error_no_address}`)
      return
    }
    if (!this.amounts || bns.lte(this.amounts.nativeAmount, '0')) {
      if (Platform.OS === 'android') {
        showError(`${s.strings.fio_request_by_fio_address_error_invalid_amount_header}. ${s.strings.fio_request_by_fio_address_error_invalid_amount}`)
        return
      } else {
        this.fioMode()
        return
      }
    }
    Actions[Constants.FIO_REQUEST_CONFIRMATION]({ amounts: this.amounts })
  }

  fioMode = () => {
    if (this.flipInput && Platform.OS === 'ios') {
      this.flipInput.textInputTopFocus()
      this.setState({ isFioMode: true })
    }
  }

  cancelFioMode = () => {
    this.setState({ isFioMode: false }, () => {
      if (this.flipInput) {
        this.flipInput.textInputTopBlur()
      }
    })
  }

  nextFioMode = () => {
    if (this.state.isFioMode && (!this.amounts || bns.lte(this.amounts.nativeAmount, '0'))) {
      showError(`${s.strings.fio_request_by_fio_address_error_invalid_amount_header}. ${s.strings.fio_request_by_fio_address_error_invalid_amount}`)
    } else {
      if (this.flipInput) {
        this.flipInput.textInputTopBlur()
      }
      this.onNext()
    }
  }
}

const rawStyles = {
  main: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center'
  },

  exchangeRateContainer: {
    alignItems: 'center',
    marginBottom: scale(10)
  },

  qrContainer: {
    backgroundColor: THEME.COLORS.QR_CODE_BACKGROUND,
    marginTop: scale(15),
    borderRadius: scale(4),
    padding: scale(4)
  },

  shareButtonsContainer: {
    alignItems: 'stretch',
    justifyContent: 'center'
  },
  accessoryView: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: THEME.COLORS.WHITE
  },
  accessoryBtn: {
    paddingVertical: scale(7),
    paddingHorizontal: scale(15)
  },
  accessoryText: {
    color: THEME.COLORS.ACCENT_BLUE,
    fontSize: scale(16)
  },
  text: {
    color: THEME.COLORS.WHITE,
    margin: scale(12)
  }
}
const styles: typeof rawStyles = StyleSheet.create(rawStyles)
