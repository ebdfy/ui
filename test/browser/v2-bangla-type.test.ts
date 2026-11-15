// Bangla's marks rise above and fall below its letters, so Bangla text in every v2 part is at least
// 13 px on a line at least 1.4 times its size, before the script and after.
import { expect, test } from 'vitest'

import '../../src/v2.css'
import { defineAvatar } from '../../src/v2/avatar.ts'
import { defineBanner } from '../../src/v2/banner.ts'
import { defineButtonGroup } from '../../src/v2/button-group.ts'
import { defineButton } from '../../src/v2/button.ts'
import { defineCard } from '../../src/v2/card.ts'
import { defineCheckbox } from '../../src/v2/checkbox.ts'
import { defineChips } from '../../src/v2/chips.ts'
import { defineChoiceList } from '../../src/v2/choice-list.ts'
import { defineContact } from '../../src/v2/contact.ts'
import { defineCourierStatus } from '../../src/v2/courier-status.ts'
import { defineDistrictPicker } from '../../src/v2/district-picker.ts'
import { defineEmptyState } from '../../src/v2/empty-state.ts'
import { defineFields } from '../../src/v2/field.ts'
import { defineIndexTable } from '../../src/v2/index-table.ts'
import { defineKbd } from '../../src/v2/kbd.ts'
import { defineMenu } from '../../src/v2/menu.ts'
import { defineMeter } from '../../src/v2/meter.ts'
import { defineModal } from '../../src/v2/modal.ts'
import { definePage } from '../../src/v2/page.ts'
import { definePagination } from '../../src/v2/pagination.ts'
import { definePhoneField } from '../../src/v2/phone-field.ts'
import { definePopover } from '../../src/v2/popover.ts'
import { defineProgressBar } from '../../src/v2/progress-bar.ts'
import { defineSelect } from '../../src/v2/select.ts'
import { defineSettingsSection } from '../../src/v2/settings-section.ts'
import { defineSetupGuide } from '../../src/v2/setup-guide.ts'
import { defineSwitch } from '../../src/v2/switch.ts'
import { defineTable } from '../../src/v2/table.ts'
import { defineTabs } from '../../src/v2/tabs.ts'
import { defineTakaField } from '../../src/v2/taka-field.ts'
import { defineText } from '../../src/v2/text.ts'
import { defineThumbnail } from '../../src/v2/thumbnail.ts'
import { defineTooltip } from '../../src/v2/tooltip.ts'

const parts = `<div lang="bn">
  <e-page heading="অর্ডারের তালিকা">
    <e-card heading="আইটেম">
      <e-heading level="1">অর্ডার</e-heading>
      <e-heading level="2">গ্রাহক</e-heading>
      <e-heading level="3">ডেলিভারি</e-heading>
      <e-text>রহিমা আক্তার আজ ১১:২৪ এ অর্ডার করেছেন</e-text>
      <e-text size="meta">মেসেঞ্জার চ্যাট থেকে</e-text>
      <e-table label="অর্ডার"><e-row head><span>অর্ডার</span><span>মোট</span></e-row><e-row><span>#1042</span><span><e-badge tone="new">নতুন</e-badge></span><span align="end">৳১,৯৩০</span></e-row></e-table>
      <e-tabs label="অর্ডারের ভিউ"><e-tab value="all" count="১২০" selected>সব</e-tab><e-tab value="new" count="১২">নতুন</e-tab></e-tabs>
      <e-metrics><div><span slot="label">আজকের অর্ডার</span> <strong>৩৮</strong> <span slot="change" tone="up">+১২%</span></div><div><span slot="label">কনফার্ম বাকি</span> <strong>১২</strong></div></e-metrics>
      <e-todo><a href="/orders"><strong>১২</strong> কনফার্ম বাকি</a><a href="/orders"><strong>১৮</strong> পাঠানো বাকি</a></e-todo>
      <e-pagination label="১–১০, মোট ১২০" has-next></e-pagination>
      <e-empty-state heading="কোনো অর্ডার মেলেনি"><p>অন্য শব্দে খুঁজুন</p></e-empty-state>
      <e-avatar name="রহিমা আক্তার"></e-avatar>
      <e-district-picker district="dhaka" upazila="mirpur" error="জেলা বাছুন" upazila-error="উপজেলা বাছুন"></e-district-picker>
      <e-courier-status status="IN_TRANSIT"></e-courier-status>
      <e-text-field label="কুরিয়ারের জন্য নোট" value="দুইবার বেল বাজান"></e-text-field>
      <e-text-area label="ঠিকানা" value="বাড়ি ১২, রোড ৫" error="ঠিকানা লিখুন"></e-text-area>
      <e-checkbox label="উপহার হিসেবে পাঠান"></e-checkbox>
      <e-phone-field label="গ্রাহকের ফোন" placeholder="০১৭০৭০৭১৫৯১" error="01 দিয়ে শুরু ১১ অঙ্কের নম্বর লিখুন"></e-phone-field>
      <e-taka-field label="ডেলিভারি চার্জ" value="80"></e-taka-field>
      <e-button>সংরক্ষণ করুন</e-button>
      <e-search-field label="অর্ডার খুঁজুন" placeholder="অর্ডার খুঁজুন"></e-search-field>
      <e-choice-list label="পেমেন্ট" name="payment"><option value="cod" selected>ক্যাশ অন ডেলিভারি</option><option value="bkash">বিকাশ</option></e-choice-list>
      <e-switch label="গ্রাহককে এসএমএস পাঠান" checked></e-switch>
      <e-date-field label="ডেলিভারির তারিখ" value="2026-11-05"></e-date-field>
      <e-list><div>রহিমা আক্তার</div></e-list>
      <e-index-table label="অর্ডার"><span slot="filter" name="date"><span>তারিখ: গত ৩০ দিন</span></span><div slot="bulk"><e-button>কনফার্ম করুন</e-button></div></e-index-table>
      <e-modal heading="অর্ডার কনফার্ম করুন"><e-text>রহিমা আক্তার</e-text><e-button slot="footer">এখন না</e-button></e-modal>
      <e-select label="সাজান"><option value="newest" selected>নতুন আগে</option><option value="oldest">পুরোনো আগে</option></e-select>
      <e-menu><e-button slot="trigger">আরও</e-button><e-menu-item>প্রিন্ট করুন</e-menu-item><e-menu-item tone="danger">অর্ডার বাতিল করুন</e-menu-item></e-menu>
      <e-button-group label="অর্ডারের ভিউ"><e-button value="all" pressed>সব</e-button><e-button value="new">নতুন</e-button></e-button-group>
      <e-text>বিস্তারিত দেখুন <e-link><a href="/orders">অর্ডারের তালিকা</a></e-link> পাতায় <e-kbd shortcut="mod+k"></e-kbd></e-text>
      <e-card heading="গ্রাহক"><e-button slot="actions">সম্পাদনা</e-button><e-button slot="actions">প্রিন্ট</e-button><e-button slot="actions">আর্কাইভ</e-button><e-text>রহিমা আক্তার</e-text></e-card>
      <e-settings-section heading="ডেলিভারি চার্জ" help="ঢাকার ভেতরে ও বাইরে কত টাকা নেবেন"><e-card><e-text>ঢাকার ভেতরে ৳৮০</e-text></e-card></e-settings-section>
      <e-setup-guide heading="স্টোর সেট আপ করুন"><e-setup-step done>প্রথম পণ্য যোগ করুন</e-setup-step><e-setup-step>কুরিয়ার যুক্ত করুন</e-setup-step></e-setup-guide>
      <e-popover label="অর্ডারের কাজ"><e-button slot="trigger">আরও</e-button><e-text>প্রিন্ট করুন</e-text></e-popover>
      <e-tooltip text="প্রিন্ট করুন"><e-button aria-label="প্রিন্ট করুন"><e-icon name="printer"></e-icon></e-button></e-tooltip>
      <e-banner tone="critical" heading="পেমেন্ট হয়নি">বিকাশ নম্বর দেখে আবার চেষ্টা করুন</e-banner>
      <e-bottom-bar><e-button>সংরক্ষণ করুন</e-button></e-bottom-bar>
      <e-progress-bar label="ছবি আপলোড হচ্ছে" value="40"></e-progress-bar>
      <e-summary><e-summary-row><span>সাবটোটাল</span><span>২টি পণ্য</span><span>৳১,৮১০</span></e-summary-row><e-summary-row total><span>মোট</span><span>৳১,৯৩০</span></e-summary-row><e-due tone="warning">ডেলিভারিতে ৳১,৯৩০ নিতে হবে</e-due></e-summary>
      <e-line-item><e-thumbnail></e-thumbnail><span slot="title">জামদানি শাড়ি, হাতে বোনা</span><span slot="meta">লাল · ফ্রি সাইজ</span><span slot="price">১ × ৳১,৪৫০</span><span slot="amount">৳১,৪৫০</span></e-line-item>
      <e-person><e-avatar name="রহিমা আক্তার" size="24"></e-avatar><a href="#">রহিমা আক্তার</a><span slot="meta">৪টি অর্ডার · ৳৯,৮৪০ খরচ</span></e-person>
      <e-contact><e-icon name="phone"></e-icon><a href="tel:01707071042">01707-071042</a></e-contact>
      <e-meter value="92" label="ডেলিভারি হয়েছে"></e-meter>
      <e-chips name="tags" label="ট্যাগ"><e-chip value="facebook" removable>ফেসবুক</e-chip><e-chip value="repeat">পুরোনো গ্রাহক</e-chip></e-chips>
      <e-timeline><e-timeline-day>আজ</e-timeline-day><e-timeline-item kind="comment"><strong slot="actor">রফিক আহমেদ</strong><time slot="time">সকাল ১১:৩১</time><p slot="body">ফোন করেছি, পরে কনফার্ম করবেন</p></e-timeline-item><e-timeline-item><strong slot="actor">রহিমা আক্তার</strong> ফেসবুক থেকে অর্ডার করেছেন <time slot="time">সকাল ১১:২৪</time></e-timeline-item></e-timeline>
    </e-card>
  </e-page>
</div>`

// Each element that holds words of its own, and the heading drawn by CSS before the script.
function lowLines(): string[] {
  const low: string[] = []
  const check = (name: string, style: CSSStyleDeclaration) => {
    const size = Number.parseFloat(style.fontSize)
    const line = Number.parseFloat(style.lineHeight)
    if (size < 13 || !(line / size >= 1.4)) low.push(`${name}: ${style.fontSize} on ${style.lineHeight}`)
  }
  // Words drawn by CSS: a heading, a label or a count in a ::before or ::after.
  for (const tag of document.querySelectorAll('[lang="bn"] *')) {
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(tag, pseudo)
      if (/^".*[\p{L}\p{N}].*"$/u.test(style.content)) check(`${tag.localName}${pseudo}`, style)
    }
  }
  for (const element of document.querySelectorAll('[lang="bn"] *')) {
    const words = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
    if (words) check(element.localName, getComputedStyle(element))
  }
  return low
}

test('before the script, every Bangla line is at least 13 px and 1.4 times its size', () => {
  document.body.innerHTML = parts
  expect(lowLines()).toEqual([])
})

function build(): void {
  definePage()
  defineCard()
  defineText()
  defineTable()
  defineTabs()
  definePagination()
  defineEmptyState()
  defineAvatar()
  defineThumbnail()
  defineContact()
  defineChips()
  defineMeter()
  defineCheckbox()
  defineSelect()
  defineFields()
  defineChoiceList()
  defineSwitch()
  defineButton()
  defineIndexTable()
  defineModal()
  defineMenu()
  defineButtonGroup()
  defineKbd()
  definePhoneField()
  defineTakaField()
  defineDistrictPicker()
  defineCourierStatus()
  defineSettingsSection()
  defineSetupGuide()
  definePopover()
  defineTooltip()
  defineBanner()
  defineProgressBar()
}

test('after the script, every Bangla line is at least 13 px and 1.4 times its size', () => {
  document.body.innerHTML = parts
  build()
  expect(document.querySelector('e-page > h1')).not.toBeNull()
  expect(lowLines()).toEqual([])
})

// A tag draws words in ::before or ::after only until the script builds the element that shows them,
// so a rule that hides a drawn word must outrank every rule that draws it, :lang(bn) ones included.
// What a tag still draws once built is its own: a tab's count, an avatar's initials and a thumbnail's letter.
test('once built, no tag still draws words in ::before or ::after, in Bangla or English', () => {
  for (const lang of ['bn', 'en']) {
    document.body.innerHTML = parts.replace('<div lang="bn">', `<div lang="${lang}">`)
    build()
    const drawn: string[] = []
    for (const tag of document.querySelectorAll('body *')) {
      for (const pseudo of ['::before', '::after']) {
        if (/^".*[\p{L}\p{N}].*"$/u.test(getComputedStyle(tag, pseudo).content)) drawn.push(`${tag.localName}${pseudo}`)
      }
    }
    expect([lang, ...new Set(drawn)]).toEqual([lang, 'e-tab::after', 'e-avatar::before', 'e-thumbnail::before'])
  }
})
