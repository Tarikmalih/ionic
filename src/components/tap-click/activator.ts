import { ActivatorBase, isActivatedDisabled } from './activator-base';
import { App } from '../app/app';
import { Config } from '../../config/config';
import { CSS, PointerCoordinates } from '../../util/dom';
import { nativeTimeout, rafFrames } from '../../util/native-window';


export class Activator implements ActivatorBase {
  protected _queue: HTMLElement[] = [];
  protected _active: HTMLElement[] = [];
  protected _activeRafDefer: Function;
  protected _clearRafDefer: Function;
  _css: string;
  activatedDelay = ADD_ACTIVATED_DEFERS;
  clearDelay = CLEAR_STATE_DEFERS;

  constructor(protected app: App, config: Config) {
    this._css = config.get('activatedClass') || 'activated';
  }

  clickAction(ev: UIEvent, activatableEle: HTMLElement, startCoord: PointerCoordinates) {
    // a click happened, so immediately deactive all activated elements
    this._scheduleClear();

    this._queue.length = 0;

    for (var i = 0; i < this._active.length; i++) {
      this._active[i].classList.remove(this._css);
    }
    this._active.length = 0;

    // then immediately activate this element
    if (activatableEle && activatableEle.parentNode) {
      this._active.push(activatableEle);
      activatableEle.classList.add(this._css);
    }
  }

  downAction(ev: UIEvent, activatableEle: HTMLElement, startCoord: PointerCoordinates) {
    // the user just pressed down
    if (isActivatedDisabled(ev, activatableEle)) {
      return;
    }

    this.unscheduleClear();
    this.deactivate(true);

    // queue to have this element activated
    this._queue.push(activatableEle);

    this._activeRafDefer = rafFrames(this.activatedDelay, () => {
      let activatableEle: HTMLElement;
      for (let i = 0; i < this._queue.length; i++) {
        activatableEle = this._queue[i];
        this._active.push(activatableEle);
        activatableEle.classList.add(this._css);
      }
      this._queue.length = 0;
      this._clearDeferred();
    });
  }

  // the user was pressing down, then just let up
  upAction(ev: UIEvent, activatableEle: HTMLElement, startCoord: PointerCoordinates) {
    this._scheduleClear();
  }

  _scheduleClear() {
    if (this._clearRafDefer) {
      return;
    }
    this._clearRafDefer = rafFrames(this.clearDelay, () => {
      this.clearState(true);
      this._clearRafDefer = null;
    });
  }

  unscheduleClear() {
    if (this._clearRafDefer) {
      this._clearRafDefer();
      this._clearRafDefer = null;
    }
  }

  // all states should return to normal
  clearState(animated: boolean) {
    if (!this.app.isEnabled()) {
      // the app is actively disabled, so don't bother deactivating anything.
      // this makes it easier on the GPU so it doesn't have to redraw any
      // buttons during a transition. This will retry in XX milliseconds.
      nativeTimeout(() => {
        this.clearState(animated);
      }, 600);

    } else {
      // not actively transitioning, good to deactivate any elements
      this.deactivate(animated);
    }
  }

  // remove the active class from all active elements
  deactivate(animated: boolean) {
    this._clearDeferred();

    this._queue.length = 0;

    let ele: HTMLElement;
    for (var i = 0; i < this._active.length; i++) {
      ele = this._active[i];
      ele.style[CSS.transition] = animated ? '' : 'none';
      ele.classList.remove(this._css);
    }
    this._active.length = 0;
  }

  _clearDeferred() {
    // Clear any active deferral
    if (this._activeRafDefer) {
      this._activeRafDefer();
      this._activeRafDefer = null;
    }
  }
}

const ADD_ACTIVATED_DEFERS = 6;
const CLEAR_STATE_DEFERS = 6;
