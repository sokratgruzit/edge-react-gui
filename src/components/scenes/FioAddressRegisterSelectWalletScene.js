// @flow

import { bns } from 'biggystring'
import { type EdgeCurrencyConfig, type EdgeCurrencyWallet, type EdgeDenomination, type EdgeTransaction } from 'edge-core-js'
import * as React from 'react'
import { ActivityIndicator, Alert, Image, ScrollView, View } from 'react-native'
import { Actions } from 'react-native-router-flux'
import { connect } from 'react-redux'
import { sprintf } from 'sprintf-js'

import * as Constants from '../../constants/indexConstants'
import s from '../../locales/strings.js'
import { getRegInfo } from '../../modules/FioAddress/util'
import * as SETTINGS_SELECTORS from '../../modules/Settings/selectors'
import { getFioWallets } from '../../modules/UI/selectors'
import type { Dispatch } from '../../types/reduxTypes'
import { type RootState } from '../../types/reduxTypes'
import type { FioDomain, GuiWallet } from '../../types/types'
import { SceneWrapper } from '../common/SceneWrapper'
import { type WalletListResult, WalletListModal } from '../modals/WalletListModal.js'
import { Airship, showError } from '../services/AirshipInstance'
import { type Theme, type ThemeProps, cacheStyles, withTheme } from '../services/ThemeContext.js'
import { EdgeText } from '../themed/EdgeText'
import { PrimaryButton } from '../themed/ThemedButtons'
import { Tile } from '../themed/Tile'

type StateProps = {
  state: RootState,
  wallets: { [string]: GuiWallet },
  fioPlugin: EdgeCurrencyConfig | null,
  fioWallets: EdgeCurrencyWallet[],
  fioDisplayDenomination: EdgeDenomination,
  defaultFiatCode: string,
  isConnected: boolean
}

type NavigationProps = {
  fioAddress: string,
  selectedWallet: EdgeCurrencyWallet,
  selectedDomain: FioDomain,
  isFallback?: boolean
}

type DispatchProps = {
  onSelectWallet: (walletId: string, currencyCode: string) => void
}

type LocalState = {
  loading: boolean,
  supportedCurrencies: { [currencyCode: string]: boolean },
  paymentInfo: { [currencyCode: string]: { amount: string, address: string } },
  activationCost: number,
  paymentWallet?: {
    id: string,
    currencyCode: string
  },
  errorMessage?: string
}

type Props = NavigationProps & StateProps & DispatchProps & ThemeProps

class FioAddressRegisterSelectWallet extends React.Component<Props, LocalState> {
  state: LocalState = {
    loading: false,
    activationCost: 40,
    supportedCurrencies: {},
    paymentInfo: {}
  }

  componentDidMount(): void {
    this.getRegInfo()
  }

  getRegInfo = async () => {
    this.setState({ loading: true })

    if (this.props.fioPlugin) {
      try {
        const { activationCost, supportedCurrencies, paymentInfo } = await getRegInfo(
          this.props.fioPlugin,
          this.props.fioAddress,
          this.props.selectedWallet,
          this.props.selectedDomain,
          this.props.fioDisplayDenomination,
          this.props.isFallback
        )
        this.setState({ activationCost, supportedCurrencies, paymentInfo })
      } catch (e) {
        showError(e)
        this.setState({ errorMessage: e.message })
      }
    }

    this.setState({ loading: false })
  }

  onNextPress = async () => {
    const { selectedDomain } = this.props
    const { activationCost } = this.state

    if (!activationCost || activationCost === 0) return

    if (selectedDomain.walletId) {
      return this.proceed(selectedDomain.walletId, Constants.FIO_STR)
    } else {
      const { paymentWallet } = this.state
      if (!paymentWallet || !paymentWallet.id) return
      return this.proceed(paymentWallet.id, paymentWallet.currencyCode)
    }
  }

  onWalletPress = () => {
    const { activationCost } = this.state
    if (!activationCost || activationCost === 0) return

    this.selectWallet()
  }

  selectWallet = async () => {
    const { supportedCurrencies } = this.state

    const allowedCurrencyCodes = []
    for (const currency of Object.keys(supportedCurrencies)) {
      if (supportedCurrencies[currency]) {
        allowedCurrencyCodes.push(currency)
      }
    }
    const { walletId, currencyCode }: WalletListResult = await Airship.show(bridge => (
      <WalletListModal bridge={bridge} headerTitle={s.strings.select_wallet} allowedCurrencyCodes={allowedCurrencyCodes} />
    ))
    if (walletId && currencyCode) {
      this.setState({ paymentWallet: { id: walletId, currencyCode } })
    }
  }

  proceed = async (walletId: string, paymentCurrencyCode: string) => {
    const { isConnected, selectedWallet, fioAddress, state } = this.props
    const { activationCost, paymentInfo: allPaymentInfo } = this.state

    if (isConnected) {
      if (paymentCurrencyCode === Constants.FIO_STR) {
        const { fioWallets } = this.props
        const paymentWallet = fioWallets.find(fioWallet => fioWallet.id === walletId)
        Actions[Constants.FIO_NAME_CONFIRM]({
          fioName: fioAddress,
          paymentWallet,
          fee: activationCost,
          ownerPublicKey: selectedWallet.publicWalletInfo.keys.publicKey
        })
      } else {
        this.props.onSelectWallet(walletId, paymentCurrencyCode)

        const exchangeDenomination = SETTINGS_SELECTORS.getExchangeDenomination(state, paymentCurrencyCode)
        let nativeAmount = bns.mul(allPaymentInfo[paymentCurrencyCode].amount, exchangeDenomination.multiplier)
        nativeAmount = bns.toFixed(nativeAmount, 0, 0)

        const guiMakeSpendInfo = {
          currencyCode: paymentCurrencyCode,
          nativeAmount,
          publicAddress: allPaymentInfo[paymentCurrencyCode].address,
          metadata: {
            name: s.strings.fio_address_register_metadata_name,
            notes: `${s.strings.title_fio_address_confirmation}\n${fioAddress}`
          },
          dismissAlert: true,
          lockInputs: true,
          onDone: (error: Error | null, edgeTransaction?: EdgeTransaction) => {
            if (error) {
              setTimeout(() => {
                showError(s.strings.create_wallet_account_error_sending_transaction)
              }, 750)
            } else if (edgeTransaction) {
              Alert.alert(
                `${s.strings.fio_address_register_form_field_label} ${s.strings.fragment_wallet_unconfirmed}`,
                sprintf(s.strings.fio_address_register_pending, s.strings.fio_address_register_form_field_label),
                [{ text: s.strings.string_ok_cap }]
              )
              Actions[Constants.WALLET_LIST]()
            }
          }
        }

        Actions[Constants.SEND_CONFIRMATION]({ guiMakeSpendInfo })
      }
    } else {
      showError(s.strings.fio_network_alert_text)
    }
  }

  renderSelectWallet = () => {
    const { selectedDomain, wallets, fioAddress } = this.props
    const { activationCost, paymentWallet, loading } = this.state

    const nextDisabled = !activationCost || activationCost === 0 || (!selectedDomain.walletId && (!paymentWallet || !paymentWallet.id))
    const costStr = loading ? s.strings.loading : `${activationCost} ${Constants.FIO_STR}`
    const walletName = !paymentWallet || !paymentWallet.id ? s.strings.choose_your_wallet : wallets[paymentWallet.id].name

    return (
      <>
        <Tile type="static" title={s.strings.fio_address_register_form_field_label} body={fioAddress} />
        {!selectedDomain.walletId && (
          <Tile type="touchable" title={s.strings.create_wallet_account_select_wallet} body={walletName} onPress={this.onWalletPress} />
        )}
        <Tile type="static" title={s.strings.create_wallet_account_amount_due} body={costStr} />
        {!loading && paymentWallet && paymentWallet.id && (
          <PrimaryButton disabled={nextDisabled} onPress={this.onNextPress} label={s.strings.string_next_capitalized} marginRem={1} />
        )}
        {loading && <ActivityIndicator color={this.props.theme.iconTappable} />}
      </>
    )
  }

  render() {
    const { theme } = this.props
    const { activationCost, errorMessage, loading } = this.state
    const styles = getStyles(theme)
    const detailsText = sprintf(s.strings.fio_address_wallet_selection_text, loading ? '-' : activationCost)
    return (
      <SceneWrapper background="theme">
        <ScrollView>
          <View style={styles.header}>
            <Image source={theme.fioAddressLogo} style={styles.image} resizeMode="cover" />
            <EdgeText style={styles.instructionalText} numberOfLines={10}>
              {detailsText}
            </EdgeText>
          </View>
          {this.renderSelectWallet()}
          {errorMessage && (
            <EdgeText style={styles.errorMessage} numberOfLines={3}>
              {errorMessage}
            </EdgeText>
          )}
          <View style={styles.bottomSpace} />
        </ScrollView>
      </SceneWrapper>
    )
  }
}

const getStyles = cacheStyles((theme: Theme) => ({
  header: {
    paddingHorizontal: theme.rem(1.25)
  },
  instructionalText: {
    paddingVertical: theme.rem(1.5),
    fontSize: theme.rem(1),
    textAlign: 'center',
    color: theme.secondaryText
  },
  text: {
    color: theme.primaryText
  },
  errorMessage: {
    margin: theme.rem(1),
    textAlign: 'center',
    color: theme.dangerText
  },
  image: {
    alignSelf: 'center',
    marginTop: theme.rem(1.5),
    height: theme.rem(3.25),
    width: theme.rem(3.5)
  },
  bottomSpace: {
    paddingBottom: theme.rem(15)
  }
}))

const FioAddressRegisterSelectWalletScene = connect(
  (state: RootState) => {
    const wallets = state.ui.wallets.byId
    const fioWallets: EdgeCurrencyWallet[] = getFioWallets(state)
    const { account } = state.core
    const fioPlugin = account && account.currencyConfig ? account.currencyConfig[Constants.CURRENCY_PLUGIN_NAMES.FIO] : null
    const fioDisplayDenomination = SETTINGS_SELECTORS.getDisplayDenomination(state, Constants.FIO_STR)

    const defaultFiatCode = SETTINGS_SELECTORS.getDefaultIsoFiat(state)

    const out: StateProps = {
      state,
      fioWallets,
      fioPlugin,
      fioDisplayDenomination,
      defaultFiatCode,
      wallets,
      isConnected: state.network.isConnected
    }
    return out
  },
  (dispatch: Dispatch): DispatchProps => ({
    onSelectWallet: (walletId: string, currencyCode: string) => {
      dispatch({ type: 'UI/WALLETS/SELECT_WALLET', data: { currencyCode: currencyCode, walletId: walletId } })
    }
  })
)(withTheme(FioAddressRegisterSelectWallet))
export { FioAddressRegisterSelectWalletScene }
