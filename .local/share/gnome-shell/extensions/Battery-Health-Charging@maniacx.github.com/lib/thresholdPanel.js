'use strict';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const QuickSettingsMenu = Main.panel.statusArea.quickSettings;

const ChargeLimitToggle = GObject.registerClass(
    class ChargeLimitToggle extends QuickSettings.QuickMenuToggle {
        constructor(settings, extensionObject, currentDevice, notifier) {
            super();
            this._notifier = notifier;
            this._settings = settings;
            this._device = currentDevice;
            this._iconFolder = extensionObject.dir.get_child('icons/hicolor/scalable/actions').get_path();
            this._chargeLimitSection = new PopupMenu.PopupMenuSection();

            // TRANSLATORS: Keep translation short if possible. Maximum  10 characters can be displayed here
            this._batteryLabel = _('Battery');
            // TRANSLATORS: Keep translation short if possible. Maximum  10 characters can be displayed here
            this._battery1Label = _('Battery 1');
            // TRANSLATORS: Keep translation short if possible. Maximum  10 characters can be displayed here
            this._battery2Label = _('Battery 2');
            this.title = this._batteryLabel;

            // TRANSLATORS: Keep translation short if possible. Maximum  21 characters can be displayed here
            this.menu.setHeader('', _('Battery Charging Mode'));

            if (this._device.deviceHaveDualBattery) {
                this._battery0Removed = this._device.battery0Removed;
                this._battery1Removed = this._device.battery1Removed;
                this.title = this._battery1Label;
            } else {
                this._battery0Removed = false;
                this._battery1Removed = false;
                this._settings.set_boolean('show-battery-panel2', false);
            }

            // Add Extension Preference shortcut button icon
            this._preferencesButton = new St.Button({
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.END,
                style_class: 'bhc-preferences-button',
            });
            const preferencesButtonIcon = new St.Icon({
                gicon: this._getIcon('bhc-settings-symbolic'),
                icon_size: 16,
            });
            this._preferencesButton.child = preferencesButtonIcon;
            this.menu.addHeaderSuffix(this._preferencesButton);
            this._headerSpacer = this.menu.box.get_first_child().get_children()[4];
            this._headerSpacer.x_expand = false;

            // Define Popup Menu
            this.menu.addMenuItem(this._chargeLimitSection);

            // Define Popup Menu for Full Capacity Mode
            // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
            this._menuItemFul = new PopupMenu.PopupImageMenuItem(_('Full Capacity Mode'), '');
            this._chargeLimitSection.addMenuItem(this._menuItemFul);

            // Define Popup Menu for Balance Mode
            if (this._device.deviceHaveBalancedMode) {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                this._menuItemBal = new PopupMenu.PopupImageMenuItem(_('Balanced Mode'), '');
                this._chargeLimitSection.addMenuItem(this._menuItemBal);
            }

            // Define Popup Menu for Maximum Life Span Mode
            // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
            this._menuItemMax = new PopupMenu.PopupImageMenuItem(_('Maximum Lifespan Mode'), '');
            this._chargeLimitSection.addMenuItem(this._menuItemMax);

            if (this._device.deviceHaveAdaptiveMode) {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                this._menuItemAdv = new PopupMenu.PopupImageMenuItem(_('Adaptive Mode'), '');
                this._chargeLimitSection.addMenuItem(this._menuItemAdv);
            }
            if (this._device.deviceHaveExpressMode) {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                this._menuItemExp = new PopupMenu.PopupImageMenuItem(_('Express Mode'), '');
                this._chargeLimitSection.addMenuItem(this._menuItemExp);
            }

            this._chargeLimitSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Define display Current Threshold Reading on sysfs
            this._currentStateMenuItem = new PopupMenu.PopupImageMenuItem('', this._getIcon('bhc-qs-current-value-symbolic'), {
                activate: false, style_class: 'bhc-popup-menu',
            });
            this._chargeLimitSection.addMenuItem(this._currentStateMenuItem);

            // update panel
            this._chargingMode = this._settings.get_string('charging-mode');
            this._chargingMode2 = this._settings.get_string('charging-mode2');
            this._switchPanelToBattery2 = this._settings.get_boolean('show-battery-panel2');
            if (!this._device.deviceHaveDualBattery)
                this.checked = this._chargingMode !== 'ful';
            this._updateIconStyle();                // update icon style
            this._updatePrefButtonVisibilty();      // Update Extension Pref Button Visibility
            this._updatePanelMenu();                // Update Panel items
            this._updateLabelAndHeaderSubtitle();   // Update lable and Header Subtitle
            if (this._settings.get_boolean('force-discharge-feature'))
                this._addForceDischargeToggle();

            // Observe changes to update Panel
            this._settings.connectObject(
                'changed::charging-mode', () => {
                    this._chargingMode = this._settings.get_string('charging-mode');
                    if (!this._device.deviceHaveDualBattery)
                        this.checked = this._chargingMode !== 'ful';
                },
                'changed::icon-style-type', () => {
                    this._updateIconStyle();
                    this._updatePanelMenu();
                },
                'changed::show-preferences', () => {
                    this._updatePrefButtonVisibilty();
                },
                'changed::show-quickmenu-subtitle', () => {
                    this._updateQuickToggleSubtitle();
                },
                this
            );

            if (this._device.deviceHaveVariableThreshold) { // customizable threshold
                this._settings.connectObject(
                    'changed::dummy-default-threshold', () => {
                        if (this._settings.get_boolean('default-threshold') && this._chargingMode !== 'adv' && this._chargingMode !== 'exp')
                            this._device.setThresholdLimit(this._chargingMode);
                    },
                    'changed::dummy-apply-threshold', () => {
                        if (this._chargingMode !== 'adv' && this._chargingMode !== 'exp')
                            this._device.setThresholdLimit(this._chargingMode);
                    },
                    this
                );
            }

            if (this._device.type === 20 || this._device.type === 21) { // device.type 20|21 is Thinkpad
                this._settings.connectObject(
                    'changed::force-discharge-feature', () => {
                        if (this._settings.get_boolean('force-discharge-feature'))
                            this._addForceDischargeToggle();
                        else
                            this._removeForceDischargeToggle();
                    },
                    this
                );
            }

            if (this._device.deviceHaveDualBattery) { // Dual battery
                this._settings.bind(
                    'show-battery-panel2',
                    this,
                    'checked',
                    Gio.SettingsBindFlags.DEFAULT);

                this.connectObject('clicked', () => {
                    this.checked = !this.checked;
                }, this);

                this._settings.connectObject(
                    'changed::charging-mode2', () => {
                        this._chargingMode2 = this._settings.get_string('charging-mode2');
                    },
                    'changed::show-battery-panel2', () => {
                        this._switchPanelToBattery2 = this._settings.get_boolean('show-battery-panel2');
                        this._updateLabelAndHeaderSubtitle();
                        this._updatePanelMenu();
                    },
                    'changed::dummy-default-threshold2', () => {
                        if (this._settings.get_boolean('default-threshold2'))
                            this._device.setThresholdLimit2(this._chargingMode2);
                    },
                    'changed::dummy-apply-threshold2', () => {
                        this._device.setThresholdLimit2(this._chargingMode2);
                    },
                    this
                );
                this._device.connectObject('battery-status-changed', () => {
                    this._battery0Removed = this._device.battery0Removed;
                    this._battery1Removed = this._device.battery1Removed;
                    this._updatePanelMenu();
                }, this);
            } else { //  Dual battery
                this.connectObject('clicked', () => {
                    let mode;
                    if (this._chargingMode === 'ful') {
                        mode = this._device.deviceHaveBalancedMode ? 'bal' : 'max';
                    } else if (this._chargingMode === 'bal') {
                        mode = 'max';
                    } else if (this._chargingMode === 'max') {
                        if (this._device.deviceHaveAdaptiveMode)
                            mode = 'adv';
                        else
                            mode = this._device.deviceHaveExpressMode ? 'exp' : 'ful';
                    } else if (this._chargingMode === 'adv') {
                        mode = this._device.deviceHaveExpressMode ? 'exp' : 'ful';
                    } else if (this._chargingMode === 'exp') {
                        mode = 'ful';
                    }
                    this._chargingMode = mode;
                    this._device.setThresholdLimit(mode);
                }, this);
            } // Dual battery

            this._menuItemFul.connectObject('activate', () => {
                Main.overview.hide();
                Main.panel.closeQuickSettings();
                if (this._switchPanelToBattery2) {
                    this._chargingMode2 = 'ful';
                    this._device.setThresholdLimit2(this._chargingMode2);
                } else {
                    this._chargingMode = 'ful';
                    this._device.setThresholdLimit(this._chargingMode);
                }
            }, this);
            if (this._device.deviceHaveBalancedMode) {
                this._menuItemBal.connectObject('activate', () => {
                    Main.panel.closeQuickSettings();
                    if (this._switchPanelToBattery2) {
                        this._chargingMode2 = 'bal';
                        this._device.setThresholdLimit2(this._chargingMode2);
                    } else {
                        this._chargingMode = 'bal';
                        this._device.setThresholdLimit(this._chargingMode);
                    }
                }, this);
            }
            this._menuItemMax.connectObject('activate', () => {
                Main.panel.closeQuickSettings();
                if (this._switchPanelToBattery2) {
                    this._chargingMode2 = 'max';
                    this._device.setThresholdLimit2(this._chargingMode2);
                } else {
                    this._chargingMode = 'max';
                    this._device.setThresholdLimit(this._chargingMode);
                }
            }, this);
            if (this._device.deviceHaveAdaptiveMode) {
                this._menuItemAdv.connectObject('activate', () => {
                    Main.panel.closeQuickSettings();
                    this._chargingMode = 'adv';
                    this._device.setThresholdLimit(this._chargingMode);
                }, this);
            }
            if (this._device.deviceHaveExpressMode) {
                this._menuItemExp.connectObject('activate', () => {
                    Main.panel.closeQuickSettings();
                    this._chargingMode = 'exp';
                    this._device.setThresholdLimit(this._chargingMode);
                }, this);
            }
            this._preferencesButton.connectObject('clicked', () => {
                Main.panel.closeQuickSettings();
                this._notifier.openPreferences();
            }, this);
            this._device.connectObject('threshold-applied', (o, updateSuccessful) => {
                if (updateSuccessful === 'success') {
                    this._settings.set_string('charging-mode', this._chargingMode);
                } else if (updateSuccessful === 'success-bat2') {
                    this._settings.set_string('charging-mode2', this._chargingMode2);
                } else {
                    this._chargingMode = this._settings.get_string('charging-mode');
                    if (this._device.deviceHaveDualBattery)
                        this._chargingMode2 = this._settings.get_string('charging-mode2');
                }
                this._updatePanelMenu();
            }, this);
        } // _init()

        _getIcon(iconName) {
            return Gio.icon_new_for_string(`${this._iconFolder}/${iconName}.svg`);
        }

        // UpdatePanelMenu UI
        _updatePanelMenu() {
            this._currentMode = this._switchPanelToBattery2 ? this._chargingMode2 : this._chargingMode;

            this._batteryNotAvailable = this._switchPanelToBattery2 && this._battery1Removed ||
                 !this._switchPanelToBattery2 && this._battery0Removed;

            if (this._device.deviceHaveDualBattery) {
                this._menuItemFul.visible = !this._batteryNotAvailable;
                if (this._device.deviceHaveBalancedMode)
                    this._menuItemBal.visible = !this._batteryNotAvailable;
                this._menuItemMax.visible = !this._batteryNotAvailable;
                this._currentStateMenuItem.reactive = !this._batteryNotAvailable;
            }

            // Update quickmenu toggle subtitle
            this._updateQuickToggleSubtitle();

            // Update quickToggleMenu icon and header icon
            let headerIcon, headerLabel;
            if (!this._batteryNotAvailable) {
                let modeIconValue;
                if (this._iconType === 'sym' || this._currentMode === 'adv' || this._currentMode === 'exp')
                    modeIconValue = '';
                else if (this._currentMode === 'ful')
                    modeIconValue = this._device.iconForFullCapMode;
                else if (this._currentMode === 'bal')
                    modeIconValue = this._device.iconForBalanceMode;
                else if (this._currentMode === 'max')
                    modeIconValue = this._device.iconForMaxLifeMode;

                headerIcon = `bhc-qs-${this._iconType}-${this._currentMode}${modeIconValue}-symbolic`;
                headerLabel = _('Battery Charging Mode');
            } else {
                headerIcon = 'bhc-qs-bat-rem-symbolic';
                // TRANSLATORS: Keep translation short if possible. Maximum  21 characters can be displayed here
                headerLabel = _('Battery Uninstalled');
            }
            this.gicon = this._getIcon(headerIcon);
            // TRANSLATORS: Keep translation short if possible. Maximum  21 characters can be displayed here
            this.menu.setHeader(this._getIcon(headerIcon), headerLabel, this._setHeaderSubtitle);

            // Set text for popup menu to display current values/modes
            let currentStateMenuString = '';
            if (this._batteryNotAvailable) {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                currentStateMenuString = _('No Battery detected!');
            } else if (this._chargingMode !== 'adv' && this._chargingMode !== 'exp' && !this._device.deviceUsesModeNotValue) {
                this._currentEndLimitValue = this._switchPanelToBattery2 ? this._device.endLimit2Value : this._device.endLimitValue;
                if (this._device.deviceHaveStartThreshold) {
                    this._currentStartLimitValue = this._switchPanelToBattery2 ? this._device.startLimit2Value : this._device.startLimitValue;
                    // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                    currentStateMenuString = _('Charge thresholds are set to %d / %d %%')
                    .format(this._currentEndLimitValue, this._currentStartLimitValue);
                } else {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                    currentStateMenuString = _('Charging Limit is set to %d%%').format(this._currentEndLimitValue);
                }
            } else if (this._device.deviceUsesModeNotValue && this._device.mode === 'ful') {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                currentStateMenuString = _('Charging Mode: Full Capacity');
            } else if (this._device.deviceUsesModeNotValue && this._device.mode === 'bal') {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                currentStateMenuString = _('Charging Mode: Balanced');
            } else if (this._device.deviceUsesModeNotValue && this._device.mode === 'max') {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                currentStateMenuString = _('Charging Mode: Maximum Lifespan');
            } else if (this._device.deviceHaveAdaptiveMode && this._device.mode === 'adv') {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                currentStateMenuString = _('Charging Mode: Adaptive');
            } else if (this._device.deviceHaveExpressMode && this._device.mode === 'exp') {
                // TRANSLATORS: Keep translation short if possible. Maximum  34 characters can be displayed here
                currentStateMenuString = _('Charging Mode: Express');
            }
            this._currentStateMenuItem.label.text = currentStateMenuString;

            // Display a check ornament to highlight current mode
            this._menuItemFul.setOrnament(this._currentMode === 'ful' ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            if (this._device.deviceHaveBalancedMode)
                this._menuItemBal.setOrnament(this._currentMode === 'bal' ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            this._menuItemMax.setOrnament(this._currentMode === 'max' ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            if (this._device.deviceHaveAdaptiveMode)
                this._menuItemAdv.setOrnament(this._currentMode === 'adv' ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            if (this._device.deviceHaveExpressMode)
                this._menuItemExp.setOrnament(this._currentMode === 'exp' ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        } //  _updatePanelMenu

        // Set Visibitly on extension pref button
        _updatePrefButtonVisibilty() {
            const prefButtonVisible = this._settings.get_boolean('show-preferences');
            this._preferencesButton.visible = prefButtonVisible;
        }

        // Update quickmenu Label(Title) and Header subtitle
        _updateLabelAndHeaderSubtitle() {
            if (this._device.deviceHaveDualBattery) {
                if (this._switchPanelToBattery2) {
                    this._setHeaderSubtitle = this._battery2Label;
                    this.title = this._battery2Label;
                } else {
                    this._setHeaderSubtitle = this._battery1Label;
                    this.title = this._battery1Label;
                }
            } else {
                this._setHeaderSubtitle = '';
                this.title = this._batteryLabel;
            }
        }

        // Update quickmenu Toggle subtitle (gnome 44 and above)
        _updateQuickToggleSubtitle() {
            if (this._settings.get_boolean('show-quickmenu-subtitle')) {
                if (this._batteryNotAvailable) {
                    // TRANSLATORS: Keep translation short if possible. Maximum  13 characters can be displayed here
                    this.subtitle = _('Uninstalled');
                } else if (this._currentMode === 'ful') {
                    // TRANSLATORS: Keep translation short if possible. Maximum  13 characters can be displayed here
                    this.subtitle = _('Full Capacity');
                } else if (this._currentMode === 'bal') {
                    // TRANSLATORS: Keep translation short if possible. Maximum  13 characters can be displayed here
                    this.subtitle = _('Balanced');
                } else if (this._currentMode === 'max') {
                    // TRANSLATORS: Keep translation short if possible. Maximum  13 characters can be displayed here
                    this.subtitle = _('Max Lifespan');
                } else if (this._currentMode === 'adv') {
                    // TRANSLATORS: Keep translation short if possible. Maximum  13 characters can be displayed here
                    this.subtitle = _('Adaptive');
                } else if (this._currentMode === 'exp') {
                    // TRANSLATORS: Keep translation short if possible. Maximum  13 characters can be displayed here
                    this.subtitle = _('Express');
                }
            } else {
                this.subtitle = null;
            }
        }

        // Update icon sytle for popupmenu
        _updateIconStyle() {
            const iconStyle = this._settings.get_int('icon-style-type');
            this._iconType = 'sym';
            if (iconStyle === 1)
                this._iconType = 'mix';
            if (iconStyle === 2)
                this._iconType = 'num';

            // Set icons Popup Menu Modes
            const iconFulValue = this._iconType === 'sym' ? '' : this._device.iconForFullCapMode;
            this._menuItemFul.setIcon(this._getIcon(`bhc-qs-${this._iconType}-ful${iconFulValue}-symbolic`));

            if (this._device.deviceHaveBalancedMode) {
                const iconBalValue = this._iconType === 'sym' ? '' : this._device.iconForBalanceMode;
                this._menuItemBal.setIcon(this._getIcon(`bhc-qs-${this._iconType}-bal${iconBalValue}-symbolic`));
            }
            const iconMaxValue = this._iconType === 'sym' ? '' : this._device.iconForMaxLifeMode;
            this._menuItemMax.setIcon(this._getIcon(`bhc-qs-${this._iconType}-max${iconMaxValue}-symbolic`));

            if (this._device.deviceHaveAdaptiveMode)
                this._menuItemAdv.setIcon(this._getIcon(`bhc-qs-${this._iconType}-adv-symbolic`));

            if (this._device.deviceHaveExpressMode)
                this._menuItemExp.setIcon(this._getIcon(`bhc-qs-${this._iconType}-exp-symbolic`));
        }

        _addForceDischargeToggle() {
            this._menuItemForceDischargeSeperator = new PopupMenu.PopupSeparatorMenuItem();
            const menuItemForceDischargeState = this._settings.get_boolean('force-discharge-enabled');
            this._menuItemForceDischarge = new PopupMenu.PopupSwitchMenuItem(_('Force Discharge'), menuItemForceDischargeState);
            this._menuItemForceDischarge.setOrnament(PopupMenu.Ornament.HIDDEN);
            this._menuItemForceDischargeIcon = new St.Icon({style_class: 'popup-menu-icon', gicon: this._getIcon('bhc-force-discharge-symbolic')});
            this._menuItemForceDischarge.replace_child(this._menuItemForceDischarge.get_first_child(), this._menuItemForceDischargeIcon);
            this._chargeLimitSection.addMenuItem(this._menuItemForceDischargeSeperator);
            this._chargeLimitSection.addMenuItem(this._menuItemForceDischarge);
            this._menuItemForceDischarge.activate = __ => {
                if (this._menuItemForceDischarge._switch.mapped)
                    this._menuItemForceDischarge.toggle();
            };
            this._menuItemForceDischarge.connectObject('toggled', (o, state) => {
                this._settings.set_boolean('force-discharge-enabled', state);
            });
        }

        _removeForceDischargeToggle() {
            this._menuItemForceDischarge.destroy();
            this._menuItemForceDischargeSeperator.destroy();
            this._menuItemForceDischargeIcon = null;
        }
    } // End ChargeLimitToggle
); // End ChargeLimitToggle

export const ChargeLimitIndicator = GObject.registerClass(
    class ChargeLimitIndicator extends QuickSettings.SystemIndicator {
        constructor(settings, extensionObject, currentDevice, notifier) {
            super();
            this._settings = settings;
            this._device = currentDevice;
            this._iconFolder = extensionObject.dir.get_child('icons/hicolor/scalable/actions').get_path();

            this._indicator = this._addIndicator();
            this._indicatorPosition = this._settings.get_int('indicator-position');
            this._indicatorIndex = this._settings.get_int('indicator-position-index');
            this._lastIndicatorPosition = this._indicatorPosition;
            this.quickSettingsItems.push(new ChargeLimitToggle(this._settings, extensionObject, this._device, notifier));
            QuickSettingsMenu.addExternalIndicator(this);
            QuickSettingsMenu._indicators.remove_child(this);
            QuickSettingsMenu._indicators.insert_child_at_index(this, this._indicatorIndex);
            this._updateLastIndicatorPosition();

            // Observe for changes to update indicator
            this._settings.connectObject(
                'changed::icon-style-type', () => {
                    this._updateIndicator();
                },
                'changed::show-system-indicator', () => {
                    this._updateIndicator();
                },
                'changed::indicator-position', () => {
                    this._updateIndicatorPosition();
                },
                this
            );

            this._device.connectObject(
                'threshold-applied', (o, updateSuccessful) => {
                    if (updateSuccessful === 'success' || updateSuccessful === 'success-bat2')
                        this._updateIndicator();
                },
                this);

            if (this._device.deviceHaveDualBattery) {         // if laptop is dual battery
                this._settings.connectObject(
                    'changed::show-battery-panel2', () => {
                        this._updateIndicator();
                    },
                    this);

                this._device.connectObject(
                    'battery-status-changed', () => {
                        this._battery0Removed = this._device.battery0Removed;
                        this._battery1Removed = this._device.battery1Removed;
                        this._updateIndicator();
                    },
                    this);

                this._battery0Removed = this._device.battery0Removed;
                this._battery1Removed = this._device.battery1Removed;
            } else {
                this._battery0Removed = false;
                this._battery1Removed = false;
            }
            this._updateIndicator();
        } // constructor

        _getIcon(iconName) {
            return Gio.icon_new_for_string(`${this._iconFolder}/${iconName}.svg`);
        }

        // start updating indicator icon
        _updateIndicator() {
            if (this._settings.get_boolean('show-system-indicator')) {    // if show indicator enabled
                this._indicator.visible = true;
                const switchPanelToBattery2 = this._settings.get_boolean('show-battery-panel2');

                const iconStyle = this._settings.get_int('icon-style-type');
                let iconType = 'sym';
                if (iconStyle === 1)
                    iconType = 'mix';
                if (iconStyle === 2)
                    iconType = 'num';

                let currentMode;
                if (switchPanelToBattery2)  // Display indicator for Battery 1 (false) or Battery 2 (true)
                    currentMode = this._settings.get_string('charging-mode2');
                else
                    currentMode = this._settings.get_string('charging-mode');

                if (!switchPanelToBattery2 && this._battery0Removed || switchPanelToBattery2 && this._battery1Removed) {
                    currentMode = 'rem';
                    iconType = 'bat';
                }

                let modeIconValue;
                if (iconType === 'sym' || currentMode === 'adv' || currentMode === 'exp ' || currentMode === 'rem')
                    modeIconValue = '';
                else if (currentMode === 'ful')
                    modeIconValue = this._device.iconForFullCapMode;
                else if (currentMode === 'bal')
                    modeIconValue = this._device.iconForBalanceMode;
                else if (currentMode === 'max')
                    modeIconValue = this._device.iconForMaxLifeMode;

                this._indicator.gicon = this._getIcon(`bhc-qs-${iconType}-${currentMode}${modeIconValue}-symbolic`);
            } else {    // else show indicator enabled
                this._indicator.visible = false;
            }    // fi show indicator enabled
        }

        _updateLastIndicatorPosition() {
            let pos = -1;
            const nbItems = QuickSettingsMenu._indicators.get_n_children();

            for (let i = 0; i < nbItems; i++) {
                const targetIndicator = QuickSettingsMenu._indicators.get_child_at_index(i);
                if (targetIndicator.is_visible())
                    pos += 1;
            }
            this._settings.set_int('indicator-position-max', pos);
        }

        _incrementIndicatorPosIndex() {
            if (this._lastIndicatorPosition < this._indicatorPosition)
                this._indicatorIndex += 1;
            else
                this._indicatorIndex -= 1;
        }

        _updateIndicatorPosition() {
            this._updateLastIndicatorPosition();
            const newPosition = this._settings.get_int('indicator-position');

            if (this._indicatorPosition !== newPosition) {
                this._indicatorPosition = newPosition;
                this._incrementIndicatorPosIndex();

                let targetIndicator = QuickSettingsMenu._indicators.get_child_at_index(this._indicatorIndex);
                const maxIndex = QuickSettingsMenu._indicators.get_n_children();
                while (this._indicatorIndex < maxIndex && !targetIndicator.is_visible() && this._indicatorIndex > -1) {
                    this._incrementIndicatorPosIndex();
                    targetIndicator = QuickSettingsMenu._indicators.get_child_at_index(this._indicatorIndex);
                }

                // Always reset index to 0 on position 0
                if (this._indicatorPosition === 0)
                    this._indicatorIndex = 0;

                // Update last position
                this._lastIndicatorPosition = newPosition;

                // Update indicator index
                QuickSettingsMenu._indicators.remove_child(this);
                QuickSettingsMenu._indicators.insert_child_at_index(this, this._indicatorIndex);
                this._settings.set_int('indicator-position-index', this._indicatorIndex);
            }
        }

        destroy() {
            this._settings.disconnectObject(this);
            this.quickSettingsItems.forEach(item => item.destroy());
            this._indicator.destroy();
            this._device = null;
            this._settings = null;
            this._indicator = null;
            this.run_dispose();
        }
    }
);


