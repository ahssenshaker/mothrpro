'use strict'

// This entry runs before ANY app modules are loaded.
// We install the global error handler here so crashes during
// module init (supabase, auth context, etc.) are caught and displayed.

/* eslint-disable no-var */
var rn = require('react-native')

var g = global
if (g.ErrorUtils) {
  var _prev = g.ErrorUtils.getGlobalHandler()
  g.ErrorUtils.setGlobalHandler(function (error, isFatal) {
    try {
      rn.Alert.alert(
        'خطأ — أرسل هذه الرسالة',
        String(error && error.message ? error.message : 'Unknown error') +
          '\n\n' +
          String(error && error.stack ? error.stack.slice(0, 500) : 'No stack trace'),
      )
    } catch (_e) {}
    if (_prev) _prev(error, isFatal)
  })
}

// Wrap the entire app load in a synchronous try/catch as a last resort
try {
  require('expo-router/entry')
} catch (e) {
  try {
    rn.Alert.alert(
      'خطأ في التحميل',
      String(e && e.message ? e.message : String(e)) +
        '\n\n' +
        String(e && e.stack ? e.stack.slice(0, 500) : ''),
    )
  } catch (_e2) {}
}
