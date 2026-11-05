// e-courier-status: writes the courier's word for a parcel as the tag's text, in the page's language,
// where the CSS drew the same words before the script, so a person and a screen reader can read it.
// status takes the kit's names or the API's ShipmentEventStatus codes; any other reads Unknown.
import { langOf } from '../lang.ts'
import { onLangChange } from './speech.ts'

const words: Record<string, [string, string]> = {
  'awaiting-pickup': ['Awaiting pickup', 'পিকআপের অপেক্ষায়'],
  'picked-up': ['Picked up', 'পিকআপ হয়েছে'],
  'with-courier': ['With courier', 'কুরিয়ারে'],
  'out-for-delivery': ['Out for delivery', 'ডেলিভারির পথে'],
  'on-hold': ['On hold', 'আটকে আছে'],
  'delivery-failed': ['Delivery failed', 'ডেলিভারি হয়নি'],
  delivered: ['Delivered', 'ডেলিভারি হয়েছে'],
  'partly-delivered': ['Partly delivered', 'আংশিক ডেলিভারি'],
  returning: ['Returning', 'ফেরত আসছে'],
  returned: ['Returned', 'ফেরত এসেছে'],
  cancelled: ['Cancelled', 'বাতিল'],
  problem: ['Problem', 'সমস্যা'],
  unknown: ['Unknown', 'অজানা'],
}

// The API's codes, by the kit's name each reads as.
const codes: Record<string, string> = {
  PENDING: 'awaiting-pickup',
  PICKED_UP: 'picked-up',
  IN_TRANSIT: 'with-courier',
  OUT_FOR_DELIVERY: 'out-for-delivery',
  ON_HOLD: 'on-hold',
  ATTEMPT_FAILED: 'delivery-failed',
  DELIVERED: 'delivered',
  PARTIAL_DELIVERED: 'partly-delivered',
  RETURNING: 'returning',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
  EXCEPTION: 'problem',
  UNKNOWN: 'unknown',
}

/**
 * A courier status names where a parcel is, in the page's language, in a badge coloured by how it
 * stands: on the way, delivered, held or failed, returned or a problem, or neutral.
 * @tag e-courier-status
 * @attr {'awaiting-pickup' | 'picked-up' | 'with-courier' | 'out-for-delivery' | 'on-hold' | 'delivery-failed' | 'delivered' | 'partly-delivered' | 'returning' | 'returned' | 'cancelled' | 'problem' | 'unknown' | 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'ON_HOLD' | 'ATTEMPT_FAILED' | 'DELIVERED' | 'PARTIAL_DELIVERED' | 'RETURNING' | 'RETURNED' | 'CANCELLED' | 'EXCEPTION' | 'UNKNOWN'} status - The parcel's status, as the kit's name or the courier API's code, such as `PICKED_UP`. Any other reads Unknown.
 */
export class ECourierStatus extends HTMLElement {
  static observedAttributes = ['status']

  #stop: (() => void) | undefined

  connectedCallback(): void {
    this.#stop = onLangChange(() => this.#say())
    this.#say()
  }

  disconnectedCallback(): void {
    this.#stop?.()
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#say()
  }

  #say(): void {
    const status = this.getAttribute('status') ?? ''
    const name = Object.hasOwn(codes, status) ? codes[status]! : status
    const [en, bn] = Object.hasOwn(words, name) ? words[name]! : words.unknown!
    this.textContent = langOf(this) === 'bn' ? bn : en
  }
}

export function defineCourierStatus(): void {
  if (!customElements.get('e-courier-status')) customElements.define('e-courier-status', ECourierStatus)
}
