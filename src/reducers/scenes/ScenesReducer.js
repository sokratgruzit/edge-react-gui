// @flow

import { type Reducer, combineReducers } from 'redux'

import { type FioAddressSceneState, fioAddress } from '../../modules/FioAddress/reducer.js'
import { type ControlPanelState, controlPanel } from '../../modules/UI/components/ControlPanel/reducer.js'
import { type ExchangeRateState, exchangeRate } from '../../modules/UI/components/ExchangeRate/reducer.js'
import type { Action } from '../../types/reduxTypes.js'
import { type EditTokenState, editToken } from '../EditTokenReducer.js'
import { type RequestTypeState, requestType } from '../RequestTypeReducer.js'
import { type UniqueIdentifierModalState, uniqueIdentifierModal } from '../UniqueIdentifierModalReducer.js'
import { type CreateWalletState, createWallet } from './CreateWalletReducer.js'
import { type ScanState, scan } from './ScanReducer.js'
import { type SendConfirmationState, sendConfirmation } from './SendConfirmationReducer.js'
import { type TransactionDetailsState, transactionDetails } from './TransactionDetailsReducer.js'
import { type TransactionListState, transactionList } from './TransactionListReducer.js'
import { type WalletListState, walletList } from './WalletListReducer.js'

export type ScenesState = {
  +controlPanel: ControlPanelState,
  +createWallet: CreateWalletState,
  +editToken: EditTokenState,
  +exchangeRate: ExchangeRateState,
  +fioAddress: FioAddressSceneState,
  +requestType: RequestTypeState,
  +scan: ScanState,
  +sendConfirmation: SendConfirmationState,
  +transactionDetails: TransactionDetailsState,
  +transactionList: TransactionListState,
  +uniqueIdentifierModal: UniqueIdentifierModalState,
  +walletList: WalletListState
}

export const scenes: Reducer<ScenesState, Action> = combineReducers({
  controlPanel,
  createWallet,
  editToken,
  exchangeRate,
  fioAddress,
  requestType,
  scan,
  sendConfirmation,
  transactionDetails,
  transactionList,
  uniqueIdentifierModal,
  walletList
})
