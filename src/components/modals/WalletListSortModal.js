// @flow

import * as React from 'react'
import { type AirshipBridge } from 'react-native-airship'
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome'
import { connect } from 'react-redux'

import { updateWalletsSort } from '../../actions/WalletListActions.js'
import s from '../../locales/strings.js'
import { type Dispatch, type RootState } from '../../types/reduxTypes.js'
import { type ThemeProps, withTheme } from '../services/ThemeContext.js'
import { ModalCloseArrow, ModalTitle } from '../themed/ModalParts.js'
import { SettingsRadioRow } from '../themed/SettingsRadioRow.js'
import { SettingsRow } from '../themed/SettingsRow.js'
import { ThemedModal } from '../themed/ThemedModal.js'

const options = [
  { key: 'manual', title: s.strings.wallet_list_sort_manual },
  { key: 'name', title: s.strings.wallet_list_sort_name },
  { key: 'currencyCode', title: s.strings.wallet_list_sort_currencyCode },
  { key: 'currencyName', title: s.strings.wallet_list_sort_currencyName },
  { key: 'highest', title: s.strings.wallet_list_sort_highest },
  { key: 'lowest', title: s.strings.wallet_list_sort_lowest }
]

export type SortOption = 'default' | 'name' | 'currencyCode' | 'currencyName' | 'highest' | 'lowest'

type OwnProps = {
  bridge: AirshipBridge<'manual' | void>
}

type StateProps = {
  sortOption: SortOption
}

type DispatchProps = {
  updateWalletsSort: (sortOption: SortOption) => void
}

type State = {
  option: SortOption
}

type Props = OwnProps & StateProps & DispatchProps & ThemeProps

class WalletListSortModalComponent extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      option: props.sortOption
    }
  }

  handleCloseModal = () => {
    this.props.updateWalletsSort(this.state.option)
    this.props.bridge.resolve()
  }

  handleManualOption = () => {
    this.props.updateWalletsSort('default')
    this.props.bridge.resolve('manual')
  }

  handleOptionKey = (option: SortOption) => (this.state.option === option ? this.setState({ option: 'default' }) : this.setState({ option }))

  render() {
    const { bridge, theme } = this.props
    return (
      <ThemedModal bridge={bridge} onCancel={this.handleCloseModal}>
        <ModalTitle>{s.strings.wallet_list_sort_title}</ModalTitle>
        {options.map(option => {
          if (option.key === 'manual') {
            const icon = <FontAwesomeIcon name="chevron-right" color={theme.iconTappable} size={theme.rem(1)} />
            return <SettingsRow key={option.key} text={option.title} right={icon} onPress={this.handleManualOption} />
          } else {
            return (
              <SettingsRadioRow
                key={option.key}
                text={option.title}
                value={this.state.option === option.key}
                onPress={() => this.handleOptionKey(option.key)}
              />
            )
          }
        })}
        <ModalCloseArrow onPress={this.handleCloseModal} />
      </ThemedModal>
    )
  }
}

export const WalletListSortModal = connect(
  (state: RootState): StateProps => ({
    sortOption: state.ui.settings.walletsSort
  }),
  (dispatch: Dispatch): DispatchProps => ({
    updateWalletsSort(sortOption: SortOption) {
      dispatch(updateWalletsSort(sortOption))
    }
  })
)(withTheme(WalletListSortModalComponent))
