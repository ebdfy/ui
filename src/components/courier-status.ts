import { LitElement, css, html, nothing } from 'lit'

import { langOf } from '../lang.ts'
import type { Status as OrderStatus, Tone } from './badge.ts'

// What a courier says happened to a shipment, as the API's ShipmentEventStatus names it, and the
// badge it shows: a tone, or the shipped status's teal while the parcel is on its way.
const statuses = {
  PENDING: { bn: 'পিকআপের অপেক্ষায়', en: 'Awaiting pickup', tone: 'neutral' },
  PICKED_UP: { bn: 'পিকআপ হয়েছে', en: 'Picked up', status: 'shipped' },
  IN_TRANSIT: { bn: 'কুরিয়ারে', en: 'With courier', status: 'shipped' },
  OUT_FOR_DELIVERY: { bn: 'ডেলিভারির পথে', en: 'Out for delivery', status: 'shipped' },
  ON_HOLD: { bn: 'আটকে আছে', en: 'On hold', tone: 'warning' },
  ATTEMPT_FAILED: { bn: 'ডেলিভারি হয়নি', en: 'Delivery failed', tone: 'warning' },
  DELIVERED: { bn: 'ডেলিভারি হয়েছে', en: 'Delivered', tone: 'success' },
  PARTIAL_DELIVERED: { bn: 'আংশিক ডেলিভারি', en: 'Partly delivered', tone: 'warning' },
  RETURNING: { bn: 'ফেরত আসছে', en: 'Returning', tone: 'warning' },
  RETURNED: { bn: 'ফেরত এসেছে', en: 'Returned', tone: 'danger' },
  CANCELLED: { bn: 'বাতিল', en: 'Cancelled', tone: 'danger' },
  EXCEPTION: { bn: 'সমস্যা', en: 'Problem', tone: 'danger' },
  UNKNOWN: { bn: 'অজানা', en: 'Unknown', tone: 'neutral' },
} satisfies Record<string, { bn: string; en: string; tone?: Tone; status?: OrderStatus }>

type Status = keyof typeof statuses

function known(code: string): code is Status {
  return Object.hasOwn(statuses, code)
}

/** Shows what a courier says happened to a parcel, in the page's language, as a badge of the right tone. */
export class EbCourierStatus extends LitElement {
  static override properties = {
    status: { type: String },
  }

  static override styles = css`
    :host {
      display: inline-block;
    }
  `

  /** The courier's code, such as IN_TRANSIT. A code the element does not know reads as unknown. */
  declare status: string

  constructor() {
    super()
    this.status = 'UNKNOWN'
  }

  override render() {
    const status: { bn: string; en: string; tone?: Tone; status?: OrderStatus } =
      statuses[known(this.status) ? this.status : 'UNKNOWN']
    return html`<eb-badge tone=${status.tone ?? nothing} status=${status.status ?? nothing}
      >${status[langOf(this)]}</eb-badge
    >`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-courier-status': EbCourierStatus
  }
}
