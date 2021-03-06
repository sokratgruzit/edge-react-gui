// @flow

// todo: enable @react-native-community/netinfo for react-native >= 0.60 or figure out how to use with Jetifier for current version
// "@react-native-community/netinfo": "3.2.1"
// import NetInfo from '@react-native-community/netinfo'

import * as React from 'react'
import { connect } from 'react-redux'

import s from '../../locales/strings'
import { type Dispatch } from '../../types/reduxTypes.js'
import { showError } from './AirshipInstance'

type Props = {
  changeConnectivity: (isConnected: boolean) => void
}

const NetInfo = {}

class NetworkActivityComponent extends React.Component<Props> {
  netInfoUnsubscribe: Function | null = null

  componentDidMount() {
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      console.log('NetworkActivity - isConnected changed: ', state.isConnected)
      this.props.changeConnectivity(state.isConnected)
      if (!state.isConnected) {
        showError(`${s.strings.network_alert_title}`)
      }
    })
  }

  componentWillUnmount() {
    this.netInfoUnsubscribe && this.netInfoUnsubscribe()
  }

  render() {
    return null
  }
}

export const NetworkActivity = connect(
  () => ({}),
  (dispatch: Dispatch) => ({
    changeConnectivity: (isConnected: boolean) => {
      return dispatch({
        type: 'NETWORK/NETWORK_STATUS',
        data: { isConnected }
      })
    }
  })
)(NetworkActivityComponent)
