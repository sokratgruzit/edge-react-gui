// @flow

import { type EdgeTransaction } from 'edge-core-js'
import * as React from 'react'
import { View } from 'react-native'

import { type Theme, cacheStyles, useTheme } from '../services/ThemeContext.js'
import { EdgeText } from '../themed/EdgeText.js'

type Props = {
  edgeTransaction: EdgeTransaction
}

export function TransactionDetailsTitle(props: Props) {
  if (props.edgeTransaction == null) return null // Should never happen!?

  const styles = getStyles(useTheme())
  const { date } = props.edgeTransaction
  const txDate = new Date(date * 1000)
  const dateString = txDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  const time = txDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })

  return (
    <View style={styles.container}>
      <EdgeText style={styles.date}>{dateString}</EdgeText>
      <EdgeText style={styles.time}>{time}</EdgeText>
    </View>
  )
}

const getStyles = cacheStyles((theme: Theme) => ({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: theme.rem(1.5)
  },
  date: {
    fontFamily: theme.fontFaceBold
  },
  time: {
    fontSize: theme.rem(0.75),
    color: theme.secondaryText
  }
}))
