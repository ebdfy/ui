import './floor.ts'
import { adminRedirect, createBridge } from './bridge.ts'
import { EbAvatar } from './components/avatar.ts'
import { EbBadge } from './components/badge.ts'
import { EbBanner } from './components/banner.ts'
import { EbBottomBar } from './components/bottom-bar.ts'
import { EbBulkBar } from './components/bulk-bar.ts'
import { EbButtonGroup } from './components/button-group.ts'
import { EbButton } from './components/button.ts'
import { EbCard } from './components/card.ts'
import { EbCheckbox } from './components/checkbox.ts'
import { EbChoiceList } from './components/choice-list.ts'
import { EbCourierStatus } from './components/courier-status.ts'
import { EbDateField } from './components/date-field.ts'
import { EbDistrictPicker } from './components/district-picker.ts'
import { EbDivider } from './components/divider.ts'
import { EbEmptyState } from './components/empty-state.ts'
import { EbGrid } from './components/grid.ts'
import { EbHeading } from './components/heading.ts'
import { EbKbd } from './components/kbd.ts'
import { EbLink } from './components/link.ts'
import { EbMenu, EbMenuItem } from './components/menu.ts'
import { EbPage } from './components/page.ts'
import { EbPagination } from './components/pagination.ts'
import { EbPhoneField } from './components/phone-field.ts'
import { EbPopover } from './components/popover.ts'
import { EbProgressBar } from './components/progress-bar.ts'
import { EbSearchField } from './components/search-field.ts'
import { EbSelect } from './components/select.ts'
import { EbSkeleton } from './components/skeleton.ts'
import { EbSpinner } from './components/spinner.ts'
import { EbStack } from './components/stack.ts'
import { EbSwitch } from './components/switch.ts'
import { EbList, EbRow, EbTable } from './components/table.ts'
import { EbTakaField } from './components/taka-field.ts'
import { EbTextArea } from './components/text-area.ts'
import { EbTextField } from './components/text-field.ts'
import { EbText } from './components/text.ts'
import { EbThumbnail } from './components/thumbnail.ts'
import { EbTooltip } from './components/tooltip.ts'
import { installFonts } from './fonts.ts'
import { showErrors } from './form-errors.ts'
import { digits, phone, taka } from './format.ts'
import { installTokens } from './tokens.ts'

const redirect = adminRedirect(window)
if (redirect) location.replace(redirect)

installTokens()
installFonts()

// One literal define per element, which is how the manifest analyzer finds each tag name.
if (!customElements.get('eb-badge')) customElements.define('eb-badge', EbBadge)
if (!customElements.get('eb-banner')) customElements.define('eb-banner', EbBanner)
if (!customElements.get('eb-courier-status')) customElements.define('eb-courier-status', EbCourierStatus)
if (!customElements.get('eb-list')) customElements.define('eb-list', EbList)
if (!customElements.get('eb-row')) customElements.define('eb-row', EbRow)
if (!customElements.get('eb-table')) customElements.define('eb-table', EbTable)
if (!customElements.get('eb-button')) customElements.define('eb-button', EbButton)
if (!customElements.get('eb-card')) customElements.define('eb-card', EbCard)
if (!customElements.get('eb-page')) customElements.define('eb-page', EbPage)
if (!customElements.get('eb-district-picker')) customElements.define('eb-district-picker', EbDistrictPicker)
if (!customElements.get('eb-date-field')) customElements.define('eb-date-field', EbDateField)
if (!customElements.get('eb-search-field')) customElements.define('eb-search-field', EbSearchField)
if (!customElements.get('eb-select')) customElements.define('eb-select', EbSelect)
if (!customElements.get('eb-text-area')) customElements.define('eb-text-area', EbTextArea)
if (!customElements.get('eb-checkbox')) customElements.define('eb-checkbox', EbCheckbox)
if (!customElements.get('eb-choice-list')) customElements.define('eb-choice-list', EbChoiceList)
if (!customElements.get('eb-switch')) customElements.define('eb-switch', EbSwitch)
if (!customElements.get('eb-phone-field')) customElements.define('eb-phone-field', EbPhoneField)
if (!customElements.get('eb-taka-field')) customElements.define('eb-taka-field', EbTakaField)
if (!customElements.get('eb-text-field')) customElements.define('eb-text-field', EbTextField)
if (!customElements.get('eb-heading')) customElements.define('eb-heading', EbHeading)
if (!customElements.get('eb-text')) customElements.define('eb-text', EbText)
if (!customElements.get('eb-link')) customElements.define('eb-link', EbLink)
if (!customElements.get('eb-stack')) customElements.define('eb-stack', EbStack)
if (!customElements.get('eb-grid')) customElements.define('eb-grid', EbGrid)
if (!customElements.get('eb-divider')) customElements.define('eb-divider', EbDivider)
if (!customElements.get('eb-spinner')) customElements.define('eb-spinner', EbSpinner)
if (!customElements.get('eb-skeleton')) customElements.define('eb-skeleton', EbSkeleton)
if (!customElements.get('eb-progress-bar')) customElements.define('eb-progress-bar', EbProgressBar)
if (!customElements.get('eb-empty-state')) customElements.define('eb-empty-state', EbEmptyState)
if (!customElements.get('eb-thumbnail')) customElements.define('eb-thumbnail', EbThumbnail)
if (!customElements.get('eb-avatar')) customElements.define('eb-avatar', EbAvatar)
if (!customElements.get('eb-pagination')) customElements.define('eb-pagination', EbPagination)
if (!customElements.get('eb-button-group')) customElements.define('eb-button-group', EbButtonGroup)
if (!customElements.get('eb-bottom-bar')) customElements.define('eb-bottom-bar', EbBottomBar)
if (!customElements.get('eb-popover')) customElements.define('eb-popover', EbPopover)
if (!customElements.get('eb-menu')) customElements.define('eb-menu', EbMenu)
if (!customElements.get('eb-menu-item')) customElements.define('eb-menu-item', EbMenuItem)
if (!customElements.get('eb-tooltip')) customElements.define('eb-tooltip', EbTooltip)
if (!customElements.get('eb-bulk-bar')) customElements.define('eb-bulk-bar', EbBulkBar)
if (!customElements.get('eb-kbd')) customElements.define('eb-kbd', EbKbd)

const ebdfy = { ...createBridge(), format: { digits, phone, taka }, showErrors }

declare global {
  var ebdfy: typeof import('./v1.ts').ebdfy
}

globalThis.ebdfy = ebdfy
export { ebdfy }
// The element classes as types only, so the declarations keep each component's import and its
// HTMLElementTagNameMap entry reaches an app that imports the package.
export type {
  EbAvatar,
  EbBadge,
  EbBanner,
  EbBottomBar,
  EbBulkBar,
  EbButton,
  EbButtonGroup,
  EbCard,
  EbCheckbox,
  EbChoiceList,
  EbCourierStatus,
  EbDateField,
  EbDistrictPicker,
  EbDivider,
  EbEmptyState,
  EbGrid,
  EbHeading,
  EbKbd,
  EbLink,
  EbList,
  EbMenu,
  EbMenuItem,
  EbPage,
  EbPagination,
  EbPhoneField,
  EbPopover,
  EbProgressBar,
  EbRow,
  EbSearchField,
  EbSelect,
  EbSkeleton,
  EbSpinner,
  EbStack,
  EbSwitch,
  EbTable,
  EbTakaField,
  EbText,
  EbTextArea,
  EbTextField,
  EbThumbnail,
  EbTooltip,
}
