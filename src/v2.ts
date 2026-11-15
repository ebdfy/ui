// The v2 kit's script, loaded with defer. v2.css has drawn every e-* tag by now; each module builds
// the native element inside its tags, in light DOM. It also holds the bridge to the Admin.
import './floor.ts'
import { adminRedirect, createBridge } from './bridge.ts'
import { digits, phone, taka } from './format.ts'
import { defineAvatar } from './v2/avatar.ts'
import { defineBanner } from './v2/banner.ts'
import { createContext, forwardSearch, keepStore, reportModals, reportPage } from './v2/bridge.ts'
import { defineButtonGroup } from './v2/button-group.ts'
import { defineButton } from './v2/button.ts'
import { defineCard } from './v2/card.ts'
import { defineCheckbox } from './v2/checkbox.ts'
import { defineChips } from './v2/chips.ts'
import { defineChoiceList } from './v2/choice-list.ts'
import { defineContact } from './v2/contact.ts'
import { defineCourierStatus } from './v2/courier-status.ts'
import { defineDistrictPicker } from './v2/district-picker.ts'
import { defineEmptyState } from './v2/empty-state.ts'
import { signFetch } from './v2/fetch.ts'
import { defineFields } from './v2/field.ts'
import { showErrors } from './v2/form-errors.ts'
import { defineIcon } from './v2/icon.ts'
import { defineIndexTable } from './v2/index-table.ts'
import { defineKbd } from './v2/kbd.ts'
import { defineMenu } from './v2/menu.ts'
import { defineMeter } from './v2/meter.ts'
import { defineModal, hideModal, showModal } from './v2/modal.ts'
import { definePage } from './v2/page.ts'
import { definePagination } from './v2/pagination.ts'
import { definePhoneField } from './v2/phone-field.ts'
import { definePopover } from './v2/popover.ts'
import { defineProgressBar } from './v2/progress-bar.ts'
import { defineSelect } from './v2/select.ts'
import { defineSettingsSection } from './v2/settings-section.ts'
import { defineSetupGuide } from './v2/setup-guide.ts'
import { defineSpinner } from './v2/spinner.ts'
import { defineSwitch } from './v2/switch.ts'
import { defineTable } from './v2/table.ts'
import { defineTabs } from './v2/tabs.ts'
import { defineTakaField } from './v2/taka-field.ts'
import { defineText } from './v2/text.ts'
import { defineThumbnail } from './v2/thumbnail.ts'
import { defineTooltip } from './v2/tooltip.ts'

const redirect = adminRedirect(window)
if (redirect) location.replace(redirect)

defineButton()
defineIcon()
defineFields()
defineChoiceList()
defineSwitch()
defineCard()
defineModal()
definePage()
defineText()
defineTable()
defineAvatar()
defineContact()
defineMeter()
defineThumbnail()
defineChips()
defineTabs()
definePagination()
defineEmptyState()
defineCheckbox()
definePhoneField()
defineTakaField()
defineSelect()
defineDistrictPicker()
defineCourierStatus()
defineIndexTable()
defineMenu()
defineButtonGroup()
defineKbd()
defineSettingsSection()
defineSetupGuide()
definePopover()
defineTooltip()
defineBanner()
defineProgressBar()
defineSpinner()

// ebdfy.modal({ src }) asks the Admin for its modal; show(id) and hide(id) work a markup <e-modal>.
const bridge = createBridge()
const modal = Object.assign((options: Parameters<typeof bridge.modal>[0]) => bridge.modal(options), {
  show: showModal,
  hide: hideModal,
})
const ebdfy = { ...bridge, ...createContext(), modal, format: { digits, phone, taka }, showErrors }
keepStore()
signFetch(window, ebdfy)
reportPage()
reportModals()
forwardSearch()

// The page's ebdfy global, typed for an app that imports the package and calls it by name.
type Ebdfy = typeof ebdfy
declare global {
  var ebdfy: Ebdfy
}

Object.assign(globalThis, { ebdfy })
export { ebdfy }
