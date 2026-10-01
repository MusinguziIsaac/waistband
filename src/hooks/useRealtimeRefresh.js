import { useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'

/**
 * Custom hook to subscribe to Supabase Realtime changes across one or multiple database tables.
 * When any INSERT, UPDATE, or DELETE happens on the watched table(s), `onRefresh` is called.
 *
 * @param {string | string[]} tables - Table name or array of table names to listen to.
 * @param {Function} onRefresh - Callback function to re-fetch or refresh data.
 * @param {boolean} [enabled=true] - Optional flag to conditionally enable/disable listening.
 */
export function useRealtimeRefresh(tables, onRefresh, enabled = true) {
  const callbackRef = useRef(onRefresh)

  // Keep latest callback ref to avoid unnecessary subscription restarts
  useEffect(() => {
    callbackRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) return

    const tableList = Array.isArray(tables) ? tables : [tables]
    if (tableList.length === 0) return

    const channelName = `realtime-refresh-${tableList.join('-')}-${Math.random().toString(36).substring(2, 7)}`
    let channel = supabase.channel(channelName)

    tableList.forEach((tbl) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tbl },
        (payload) => {
          console.log(`[Realtime] DB change detected in ${tbl}:`, payload)
          if (callbackRef.current) {
            callbackRef.current(payload)
          }
        }
      )
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Connected to realtime
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [JSON.stringify(tables), enabled])
}
