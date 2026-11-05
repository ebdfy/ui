// The Admin chrome's rules: how long an app has to answer, how long a toast stays, how much of an
// app's text it shows, and its own words in both languages. Plain TypeScript with no framework, so
// v2-host.js and v2.js's modal share them.
export const titleLimit = 60
export const toastLimit = 120
export const navLabelLimit = 24
// How long an app has to answer before the chrome says it isn't responding.
export const answerSeconds = 15
export const toastSeconds = 5

export const words = {
  bn: {
    loading: 'লোড হচ্ছে',
    stalled: 'অ্যাপটি সাড়া দিচ্ছে না',
    reload: 'আবার লোড করুন',
    unsaved: 'অসংরক্ষিত পরিবর্তন',
    discard: 'বাতিল',
    save: 'সংরক্ষণ',
    dismiss: 'বন্ধ করুন',
    leaveAsk: 'সংরক্ষণ না করে চলে যাবেন?',
    leave: 'চলে যান',
    stay: 'থাকুন',
    close: 'বন্ধ করুন',
    closeAsk: 'সংরক্ষণ না করে বন্ধ করবেন?',
    keepEditing: 'সম্পাদনা চালিয়ে যান',
    closeAnyway: 'সংরক্ষণ না করে বন্ধ করুন',
    accessEnded: 'এই স্টোরে আপনার আর অ্যাক্সেস নেই',
    chooseStore: 'একটি স্টোর বেছে নিন',
    back: 'ফিরে যান',
    stalledHelp: '১৫ সেকেন্ডেও অ্যাপটি সাড়া দেয়নি। আবার লোড করুন, অথবা আরও অপেক্ষা করুন।',
    keepWaiting: 'অপেক্ষা করুন',
    accessHelp: 'স্টোরের মালিককে আবার যোগ করতে বলুন, অথবা অন্য একটি স্টোর বেছে নিন।',
    tryAgain: 'আবার চেষ্টা করুন',
  },
  en: {
    loading: 'Loading',
    stalled: "This app isn't responding",
    reload: 'Reload',
    unsaved: 'Unsaved changes',
    discard: 'Discard',
    save: 'Save',
    dismiss: 'Dismiss',
    leaveAsk: 'Leave without saving?',
    leave: 'Leave',
    stay: 'Stay',
    close: 'Close',
    closeAsk: 'Close without saving?',
    keepEditing: 'Keep editing',
    closeAnyway: 'Close without saving',
    accessEnded: 'You no longer have access to this store',
    chooseStore: 'Choose a store',
    back: 'Back',
    stalledHelp: "It hasn't answered for 15 seconds. Reload it, or keep waiting.",
    keepWaiting: 'Keep waiting',
    accessHelp: "Ask the store's owner to add you again, or choose another store.",
    tryAgain: 'Try again',
  },
}

const letters = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Counts letters, not code points, so a Bangla conjunct is never split.
export function cut(text: string, limit: number): string {
  const parts = Array.from(letters.segment(text), (s) => s.segment)
  return parts.length <= limit ? text : `${parts.slice(0, limit - 1).join('')}…`
}

export function cutTitle(title: string): string {
  return cut(title, titleLimit)
}
