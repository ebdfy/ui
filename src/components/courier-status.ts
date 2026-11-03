import { LitElement, css, html } from 'lit'

import { langOf } from '../lang.ts'
import type { Tone } from './badge.ts'

// What a courier says happened to a shipment, as the API's ShipmentEventStatus names it.
const statuses = {
  PENDING: { bn: 'পিকআপের অপেক্ষায়', en: 'Awaiting pickup', tone: 'info' },
  PICKED_UP: { bn: 'পিকআপ হয়েছে', en: 'Picked up', tone: 'shipped' },
  IN_TRANSIT: { bn: 'কুরিয়ারে', en: 'With courier', tone: 'shipped' },
  OUT_FOR_DELIVERY: { bn: 'ডেলিভারির পথে', en: 'Out for delivery', tone: 'shipped' },
  ON_HOLD: { bn: 'আটকে আছে', en: 'On hold', tone: 'attention' },
  ATTEMPT_FAILED: { bn: 'ডেলিভারি হয়নি', en: 'Delivery failed', tone: 'attention' },
  DELIVERED: { bn: 'ডেলিভারি হয়েছে', en: 'Delivered', tone: 'success' },
  PARTIAL_DELIVERED: { bn: 'আংশিক ডেলিভারি', en: 'Partly delivered', tone: 'attention' },
  RETURNING: { bn: 'ফেরত আসছে', en: 'Returning', tone: 'attention' },
  RETURNED: { bn: 'ফেরত এসেছে', en: 'Returned', tone: 'critical' },
  CANCELLED: { bn: 'বাতিল', en: 'Cancelled', tone: 'critical' },
  EXCEPTION: { bn: 'সমস্যা', en: 'Problem', tone: 'critical' },
  UNKNOWN: { bn: 'অজানা', en: 'Unknown', tone: 'info' },
} satisfies Record<string, { bn: string; en: string; tone: Tone }>

type Status = keyof typeof statuses

function known(code: string): code is Status {
  return Object.hasOwn(statuses, code)
}

export class EbCourierStatus extends LitElement {
  static override properties = {
    status: { type: String },
  }

  static override styles = css`
    :host {
      display: inline-block;
    }
  `

  declare status: string

  constructor() {
    super()
    this.status = 'UNKNOWN'
  }

  override render() {
    const status = statuses[known(this.status) ? this.status : 'UNKNOWN']
    return html`<eb-badge tone=${status.tone}>${status[langOf(this)]}</eb-badge>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-courier-status': EbCourierStatus
  }
}
