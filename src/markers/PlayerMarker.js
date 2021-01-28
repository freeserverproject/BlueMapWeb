import {Marker} from "./Marker";
import {CSS2DObject} from "../util/CSS2DRenderer";
import {animate, EasingFunctions, htmlToElement} from "../util/Utils";
import {Vector3} from "three";

export class PlayerMarker extends Marker {

    /**
     * @param markerId {string}
     * @param playerUuid {string}
     */
    constructor(markerId, playerUuid) {
        super(markerId);
        Object.defineProperty(this, 'isPlayerMarker', {value: true});
        this.markerType = "player";

        this.playerUuid = playerUuid;

        this.elementObject = new CSS2DObject(htmlToElement(`
<div id="bm-marker-${this.markerId}" class="bm-marker-${this.markerType}">
    <img src="assets/playerheads/${this.playerUuid}.png" alt="playerhead" draggable="false">
    <div class="bm-player-name"></div>
</div>
        `));
        this.elementObject.onBeforeRender = (renderer, scene, camera) => this.onBeforeRender(renderer, scene, camera);

        this.playerHeadElement = this.element.getElementsByTagName("img")[0];
        this.playerNameElement = this.element.getElementsByTagName("div")[0];

        this.addEventListener( 'removed', () => {
            if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
        });

        this.playerHeadElement.addEventListener('error', () => {
            this.playerHeadElement.src = "assets/playerheads/steve.png";
        }, {once: true});

        this.add(this.elementObject);
    }

    /**
     * @returns {Element}
     */
    get element() {
        return this.elementObject.element;
    }

    onBeforeRender(renderer, scene, camera) {
        this.element.setAttribute("distance-data", Marker.calculateDistanceToCameraPlane(this.position, camera).toString());
    }

    /**
     * @typedef PlayerLike {{
     *      uuid: string,
     *      name: string,
     *      world: string,
     *      position: {x: number, y: number, z: number},
     *      rotation: {yaw: number, pitch: number, roll: number}
     * }}
     */

    /**
     * @param markerData {PlayerLike}
     */
    updateFromData(markerData) {

        // animate position update
        let pos = markerData.position || {};
        if (!this.position.x && !this.position.y && !this.position.z) {
            this.position.set(
                pos.x || 0,
                pos.y || 0,
                pos.z || 0
            );
        } else {
            let startPos = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z,
            }
            let deltaPos = {
                x: (pos.x || 0) - startPos.x,
                y: (pos.y || 0) - startPos.y,
                z: (pos.z || 0) - startPos.z,
            }
            if (deltaPos.x || deltaPos.y || deltaPos.z) {
                animate(progress => {
                    let ease = EasingFunctions.easeInOutCubic(progress);
                    this.position.set(
                        startPos.x + deltaPos.x * ease || 0,
                        startPos.y + deltaPos.y * ease || 0,
                        startPos.z + deltaPos.z * ease || 0
                    );
                }, 500);
            }
        }

        // update name
        let name = markerData.name || this.playerUuid;
        if (this.playerNameElement.innerHTML !== name)
            this.playerNameElement.innerHTML = name;

    }

    dispose() {
        super.dispose();

        if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
    }

}