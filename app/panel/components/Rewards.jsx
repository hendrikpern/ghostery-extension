/**
 * Rewards Component
 *
 * Ghostery Browser Extension
 * https://www.ghostery.com/
 *
 * Copyright 2019 Ghostery, Inc. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0
 */

import React from 'react';
import ClassNames from 'classnames';
import { Route } from 'react-router-dom';
import { ToggleSlider } from './BuildingBlocks';
import { DynamicUIPortContext } from '../contexts/DynamicUIPortContext';
import { sendMessage } from '../utils/msg';
import globals from '../../../src/classes/Globals';
import { log } from '../../../src/utils/common';

const IS_CLIQZ = (globals.BROWSER_INFO.name === 'cliqz');

/**
 * @class The Rewards Panel shows offers generated by Ghostery Rewards.
 * The panel is opened from a button in the Detailed View's footer.
 * See DetailMenu.jsx.
 * @memberof PanelClasses
 */
class Rewards extends React.Component {
	static contextType = DynamicUIPortContext;

	constructor(props) {
		super(props);
		this.state = {
			iframeWidth: 0,
			iframeHeight: 0,
			shouldHideRewards: false,
			rewardsCount: 0,
		};

		// event bindings
		this.toggleOffers = this.toggleOffers.bind(this);

		// helper render functions
		this.renderRewardListComponent = this.renderRewardListComponent.bind(this);
		this.handleFaqClick = this.handleFaqClick.bind(this);
		this.handlePortMessage = this.handlePortMessage.bind(this);


		// myoffrz
		this.iframe = React.createRef();
		this.handleMyoffrzMessage = this.handleMyoffrzMessage.bind(this);
	}

	/**
	 * Lifecycle event
	 */
	componentDidMount() {
		this._dynamicUIPort = this.context;
		this._dynamicUIPort.onMessage.addListener(this.handlePortMessage);
		window.addEventListener('message', this.handleMyoffrzMessage);

		this._dynamicUIPort.postMessage({ name: 'RewardsComponentDidMount' });
		this.props.actions.sendSignal('hub_open');
	}

	/**
	 * Lifecycle event
	 */
	componentWillUnmount() {
		/* @TODO send message to background to remove port onDisconnect event */
		this.props.actions.sendSignal('hub_closed');
		this._dynamicUIPort.postMessage({ name: 'RewardsComponentWillUnmount' });
		this._dynamicUIPort.onMessage.removeListener(this.handlePortMessage);
		window.removeEventListener('message', this.handleMyoffrzMessage);
	}

	/**
   * Handles message from the dynamic UI port to background
   */
	handlePortMessage(msg) {
		if (msg.to !== 'rewards' || !msg.body) { return; }

		// msg.body can contain enable_offers prop
		this.props.actions.updateRewardsData(msg.body);
	}

	iframeResize(data = {}) {
		const { width = 0, height = 0 } = data;
		this.setState({ iframeWidth: width, iframeHeight: height });
	}

	sendToIframe(message) {
		if (!this.iframe.current) { return; }
		this.iframe.current.contentWindow.postMessage(JSON.stringify({
			target: 'cliqz-offers-cc',
			origin: 'window',
			message,
		}), '*');
	}

	myoffrzSendRuntimeMessage({ message, target }) {
		chrome.runtime.sendMessage({ message, target }, (result = {}) => {
			if (chrome.runtime.lastError) {
				log('myoffrzSendRuntimeMessage, runtime.lastError', chrome.runtime.lastError);
				return;
			}
			if (result.action !== 'pushData') { return; }
			const { data: { vouchers = [] } = {} } = result;
			const rewardsCount = vouchers.length;
			this.setState({ shouldHideRewards: rewardsCount === 0, rewardsCount });

			if (!this.iframe.current) { return; }
			this.iframe.current.frameBorder = 0;
			this.sendToIframe(result);
		});
	}

	handleMyoffrzMessage(msg = {}) {
		let target;
		let message;
		try {
			const parsedData = JSON.parse(msg.data || '{}');
			target = parsedData.target;
			message = parsedData.message || {};
		} catch (e) {
			// just silent return
			return;
		}

		if (target !== 'cliqz-offers-cc') { return; }
		if (message.action === 'resize') {
			this.iframeResize(message.data);
		} else {
			this.myoffrzSendRuntimeMessage({ message, target });
		}
	}

	/**
	 * Handles clicking the learn more button
	 */
	handleFaqClick() {
		sendMessage('openNewTab', {
			url: 'https://www.ghostery.com/faqs/what-new-ghostery-features-can-we-expect-in-the-future/',
			become_active: true,
		});
		sendMessage('ping', 'rewards_learn');
	}

	/**
	 * Handles toggling rewards on/off
	 */
	toggleOffers() {
		const { enable_offers } = this.props;
		this.props.actions.showNotification({
			text: !enable_offers ? t('rewards_on_toast_notification') : t('rewards_off_toast_notification'),
			classes: 'purple',
		});
		this.props.actions.toggleOffersEnabled(!enable_offers);
		const signal = {
			actionId: enable_offers ? 'rewards_off' : 'rewards_on',
			origin: 'rewards-hub',
			type: 'action-signal',
		};
		sendMessage('setPanelData', { enable_offers: !enable_offers, signal }, 'rewardsPanel');
		sendMessage('ping', enable_offers ? 'rewards_on' : 'rewards_off');
		// TODO catch
	}

	/**
	 * Helper render function for the Rewards Header
	 * @return {JSX} JSX for the Rewards Header
	 */
	renderRewardsHeader = () => {
		const { enable_offers } = this.props;
		const headerClassNames = ClassNames('RewardsPanel__header', 'flex-container', 'align-middle', 'align-justify');
		const headerTitleClassNames = ClassNames('RewardsPanel__title');
		const shouldHideSlider = IS_CLIQZ;

		return (
			<div className={headerClassNames}>
				<span className={headerTitleClassNames}>{ t('ghostery_rewards') }</span>
				{!shouldHideSlider && (
					<span className="flex-container align-middle">
						<span className="RewardsPanel__slider_text">
							{enable_offers ? t('rewards_on') : t('rewards_off')}
						</span>
						<ToggleSlider
							className="display-inline-block"
							isChecked={enable_offers}
							onChange={this.toggleOffers}
						/>
					</span>
				)}
			</div>
		);
	}

	/**
	 * Helper render function for Reward Icon SVG
	 * @return {JSX} JSX for the Rewards Icon SVG
	 */
	renderRewardSvg() {
		return (
			<svg className="RewardsPanel__reward_icon" viewBox="0 0 18 23" width="50" height="50">
				<g strokeWidth=".5" fillRule="evenodd">
					<path d="M7.633 9.847h2.756v-3.34H7.633v3.34zm2.502-4.64c.012.036.026.07.04.106 1.12-.076 2.258-.053 3.356-.255 1.298-.238 1.79-1.608 1.09-2.72-.606-.96-2.15-1.157-2.77-.292-.53.739-.947 1.559-1.394 2.356-.14.25-.217.536-.322.805zm-2.213.083c-.169-.558-1.107-2.375-1.487-2.898a3.492 3.492 0 0 0-.144-.191 1.795 1.795 0 0 0-3.086.445c-.4.966.168 2.197 1.11 2.402 1.182.257 2.386.166 3.607.242zm3.588 4.54h4.821V6.503h-4.82V9.83zm-9.806.02h4.833V6.5H1.704v3.35zm5.92 10.028h2.755v-8.92H7.624v8.92zm3.895.046h4.007v-8.972h-4.007v8.972zm-9.01-.046h4.024v-8.93H2.508v8.93zm-1.082-8.867c-.711-.188-.856-.092-.848-1.108.009-1.245.002-2.49.003-3.737 0-.584.157-.74.744-.74.41 0 .82.001 1.228-.001.085 0 .168-.01.228-.014-.208-.365-.456-.697-.596-1.069A2.87 2.87 0 0 1 3.534.807c1.308-.68 2.851-.296 3.705.938.648.94 1.146 1.961 1.598 3.007.045.103.096.205.17.364.106-.223.192-.392.267-.565.411-.935.843-1.86 1.433-2.702.513-.73 1.166-1.229 2.08-1.347 1.485-.192 2.915.87 3.161 2.353.144.868-.074 1.636-.577 2.34l-.161.221c.087.013.149.03.212.03.472-.002.944-.005 1.415-.012.353-.007.58.193.58.545a745.66 745.66 0 0 1 0 4.405c0 .297-.184.491-.487.534-.104.016-.21.018-.344.03v9.161c0 .106.003.214-.005.32-.028.364-.16.506-.519.56-.114.017-.231.017-.347.017l-13.427.001c-.072 0-.144.001-.214-.002-.489-.029-.647-.192-.647-.686v-9.308z" />
				</g>
			</svg>
		);
	}

	renderCLIQZtext() {
		return (
			<div className="RewardsPanel__info">
				{ this.renderRewardSvg() }
				<div>{ t('panel_detail_rewards_cliqz_text') }</div>
				<hr />
				<div
					className="RewardsPanel__learn_more button primary hollow"
					onClick={this.handleFaqClick}
				>
					{ t('panel_detail_learn_more') }
				</div>
			</div>
		);
	}

	renderRewardsTurnoffText() {
		return (
			<div className="RewardsPanel__info">
				{ this.renderRewardSvg() }
				<div>{ t('panel_detail_rewards_off') }</div>
			</div>
		);
	}

	renderRewardsNoneFoundText() {
		return (
			<div className="RewardsPanel__info">
				{ this.renderRewardSvg() }
				<div>{ t('panel_detail_rewards_none_found') }</div>
			</div>
		);
	}

	/**
	 * Helper render function for the list of Rewards Items
	 * @return {JSX} JSX for the Rewards Items List
	 */
	renderRewardListComponent() {
		if (IS_CLIQZ) { return this.renderCLIQZtext(); }
		const { enable_offers, is_expanded } = this.props;
		if (!enable_offers) { return this.renderRewardsTurnoffText(); }

		const {
			shouldHideRewards,
			iframeWidth,
			iframeHeight,
			rewardsCount,
		} = this.state;
		if (shouldHideRewards) { return this.renderRewardsNoneFoundText(); }

		const src = chrome.runtime.getURL('cliqz/offers-cc/index.html?cross-origin');
		const text = t(`panel_rewards_view__reward${rewardsCount === 1 ? '' : 's'}`);
		return (
			<>
				{is_expanded && (
					<div className="RewardsPanel__rewards_count_wrapper">
						<div className="RewardsPanel__rewards_count">{rewardsCount}</div>
						<div className="RewardsPanel__rewards_count_title">{text}</div>
					</div>
				)}
				<iframe
					ref={this.iframe}
					className="RewardsPanel__myoffrz_iframe"
					src={src}
					width={iframeWidth}
					height={iframeHeight}
					title="myoffrz-rewards"
				/>
			</>
		);
	}

	/**
	 * React's required render function. Returns JSX
	 * @return {JSX} JSX for rendering the Rewards portion of the Detailed View
	 */
	render() {
		return (
			<div className="RewardsPanel">
				<Route path="/detail/rewards/list/:id?" render={this.renderRewardsHeader} />
				<Route path="/detail/rewards/list" render={this.renderRewardListComponent} />
			</div>
		);
	}
}

export default Rewards;
