// @flow

import { type EdgeAccount } from 'edge-core-js'
import * as React from 'react'
import { Alert, FlatList, Image, Keyboard, StyleSheet, TouchableHighlight, View } from 'react-native'
import { Actions } from 'react-native-router-flux'
import { connect } from 'react-redux'

import { CREATE_WALLET_CHOICE, CREATE_WALLET_SELECT_FIAT, getSpecialCurrencyInfo, SPECIAL_CURRENCY_INFO } from '../../constants/indexConstants.js'
import s from '../../locales/strings.js'
import Text from '../../modules/UI/components/FormattedText/FormattedText.ui.js'
import { THEME } from '../../theme/variables/airbitz.js'
import { type Dispatch, type RootState } from '../../types/reduxTypes.js'
import { type CreateWalletType, type FlatListItem } from '../../types/types.js'
import { getCreateWalletTypes } from '../../util/CurrencyInfoHelpers.js'
import { scale } from '../../util/scaling.js'
import { FormField } from '../common/FormField.js'
import { SceneWrapper } from '../common/SceneWrapper.js'

type StateProps = {
  account: EdgeAccount
}
type Props = StateProps

type State = {
  selectedWalletType: string,
  searchTerm: string
}

class CreateWalletSelectCryptoComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      selectedWalletType: '',
      searchTerm: ''
    }
  }

  getWalletType(walletType: string): CreateWalletType | void {
    const { account } = this.props
    return getCreateWalletTypes(account).find(type => type.walletType === walletType)
  }

  onNext = () => {
    const { selectedWalletType } = this.state

    // Find the details about the wallet type:
    const createWalletType = this.getWalletType(selectedWalletType)
    if (createWalletType == null) {
      Alert.alert(s.strings.create_wallet_invalid_input, s.strings.create_wallet_select_valid_crypto)
      return
    }

    // Does this wallet type support private key import?
    const { currencyCode } = createWalletType
    const { isImportKeySupported } = getSpecialCurrencyInfo(currencyCode)

    // Go to the next screen:
    if (isImportKeySupported) {
      Actions[CREATE_WALLET_CHOICE]({
        selectedWalletType: createWalletType
      })
    } else {
      Actions[CREATE_WALLET_SELECT_FIAT]({
        selectedWalletType: createWalletType
      })
    }
  }

  onBack = () => {
    Keyboard.dismiss()
    Actions.pop() // redirect to the list of wallets
  }

  handleSearchTermChange = (searchTerm: string): void => {
    this.setState({
      searchTerm
    })
  }

  handleSelectWalletType = (item: CreateWalletType): void => {
    this.setState({ selectedWalletType: item.walletType }, this.onNext)
  }

  handleOnFocus = () => {}

  handleOnBlur = () => {}

  render() {
    const { account } = this.props
    const { searchTerm } = this.state
    const lowerSearch = searchTerm.toLowerCase()

    // Sort and filter the available types:
    const sortedArray = getCreateWalletTypes(account)
    const filteredArray = sortedArray.filter(
      entry =>
        !SPECIAL_CURRENCY_INFO[entry.currencyCode]?.keysOnlyMode &&
        (entry.currencyName.toLowerCase().indexOf(lowerSearch) >= 0 || entry.currencyCode.toLowerCase().indexOf(lowerSearch) >= 0)
    )

    return (
      <SceneWrapper avoidKeyboard background="body">
        {gap => (
          <View style={[styles.content, { marginBottom: -gap.bottom }]}>
            <FormField
              autoFocus
              onFocus={this.handleOnFocus}
              onBlur={this.handleOnBlur}
              autoCorrect={false}
              autoCapitalize="words"
              onChangeText={this.handleSearchTermChange}
              value={this.state.searchTerm}
              label={s.strings.create_wallet_choose_crypto}
              returnKeyType="search"
            />
            <FlatList
              style={styles.resultList}
              automaticallyAdjustContentInsets={false}
              contentContainerStyle={{ paddingBottom: gap.bottom }}
              data={filteredArray}
              initialNumToRender={12}
              keyboardShouldPersistTaps="handled"
              keyExtractor={this.keyExtractor}
              renderItem={this.renderWalletTypeResult}
            />
          </View>
        )}
      </SceneWrapper>
    )
  }

  renderWalletTypeResult = (data: FlatListItem<CreateWalletType>) => {
    const { walletType, symbolImageDarkMono, currencyCode } = data.item

    // Ripple hack:
    let { currencyName } = data.item
    if (currencyCode.toLowerCase() === 'xrp') currencyName = 'Ripple'

    return (
      <View style={[styles.singleCryptoTypeWrap, walletType === this.state.selectedWalletType && styles.selectedItem]}>
        <TouchableHighlight style={styles.singleCryptoType} onPress={() => this.handleSelectWalletType(data.item)} underlayColor={THEME.COLORS.GRAY_4}>
          <View style={styles.cryptoTypeInfoWrap}>
            <View style={styles.cryptoTypeLeft}>
              <View style={styles.cryptoTypeLogo}>
                {symbolImageDarkMono ? (
                  <Image source={{ uri: symbolImageDarkMono }} style={[styles.cryptoTypeLogo, { borderRadius: 20 }]} />
                ) : (
                  <View style={styles.cryptoTypeLogo} />
                )}
              </View>
              <View style={styles.cryptoTypeLeftTextWrap}>
                <Text style={styles.cryptoTypeName}>
                  {currencyName} - {currencyCode}
                </Text>
              </View>
            </View>
          </View>
        </TouchableHighlight>
      </View>
    )
  }

  keyExtractor = (item: CreateWalletType, index: number): string => {
    return item.walletType
  }
}

const rawStyles = {
  content: {
    backgroundColor: THEME.COLORS.WHITE,
    flex: 1,
    paddingHorizontal: scale(20)
  },
  resultList: {
    backgroundColor: THEME.COLORS.WHITE,
    borderTopColor: THEME.COLORS.GRAY_3,
    borderTopWidth: 1,
    flex: 1
  },
  selectedItem: {
    backgroundColor: THEME.COLORS.GRAY_4,
    borderLeftWidth: scale(1),
    borderLeftColor: THEME.COLORS.GRAY_3,
    borderRightWidth: scale(1),
    borderRightColor: THEME.COLORS.GRAY_3
  },
  singleCryptoType: {
    height: scale(60),
    borderBottomWidth: scale(1),
    borderBottomColor: THEME.COLORS.GRAY_3,
    paddingVertical: scale(10),
    paddingHorizontal: scale(15)
  },
  singleCryptoTypeWrap: {
    flexDirection: 'column',
    flex: 1
  },
  cryptoTypeInfoWrap: {
    flexDirection: 'row',
    height: scale(40),
    flex: 1,
    justifyContent: 'space-between'
  },
  cryptoTypeLeft: {
    flexDirection: 'row'
  },
  cryptoTypeLogo: {
    width: scale(40),
    height: scale(40),
    marginRight: scale(10)
  },
  cryptoTypeLeftTextWrap: {
    justifyContent: 'center'
  },
  cryptoTypeName: {
    fontSize: scale(16),
    color: THEME.COLORS.GRAY_1,
    textAlignVertical: 'center'
  }
}
const styles: typeof rawStyles = StyleSheet.create(rawStyles)

export const CreateWalletSelectCryptoScene = connect(
  (state: RootState): StateProps => ({
    account: state.core.account
  }),
  (dispatch: Dispatch) => ({})
)(CreateWalletSelectCryptoComponent)
