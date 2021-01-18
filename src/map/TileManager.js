/*
 * This file is part of BlueMap, licensed under the MIT License (MIT).
 *
 * Copyright (c) Blue (Lukas Rieger) <https://bluecolored.de>
 * Copyright (c) contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { Vector2 } from 'three';
import  { Tile } from './Tile.js';
import {alert, hashTile} from '../util/Utils.js';
import {TileMap} from "./TileMap";

export class TileManager {

    static tileMapSize = 100;
    static tileMapHalfSize = TileManager.tileMapSize / 2;

    constructor(scene, tileLoader, onTileLoad = null, onTileUnload = null, events = null) {
        Object.defineProperty( this, 'isTileManager', { value: true } );

        this.events = events;
        this.scene = scene;
        this.tileLoader = tileLoader;

        this.onTileLoad = onTileLoad || function(){};
        this.onTileUnload = onTileUnload || function(){};

        this.viewDistanceX = 1;
        this.viewDistanceZ = 1;
        this.centerTile = new Vector2(0, 0);

        this.currentlyLoading = 0;
        this.loadTimeout = null;

        //map of loaded tiles
        this.tiles = {};

        // a canvas that keeps track of the loaded tiles, used for shaders
        this.tileMap = new TileMap(TileManager.tileMapSize, TileManager.tileMapSize);

        this.unloaded = true;
    }

    loadAroundTile(x, z, viewDistanceX, viewDistanceZ) {
        this.unloaded = false;

        this.viewDistanceX = viewDistanceX;
        this.viewDistanceZ = viewDistanceZ;

        if (this.centerTile.x !== x || this.centerTile.y !== z) {
            this.centerTile.set(x, z);
            this.removeFarTiles();

            this.tileMap.setAll(TileMap.EMPTY);
            let keys = Object.keys(this.tiles);
            for (let i = 0; i < keys.length; i++) {
                if (!this.tiles.hasOwnProperty(keys[i])) continue;

                let tile = this.tiles[keys[i]];
                if (!tile.loading) {
                    this.tileMap.setTile(tile.x - this.centerTile.x + TileManager.tileMapHalfSize, tile.z - this.centerTile.y + TileManager.tileMapHalfSize, TileMap.LOADED);
                }
            }
        }

        this.loadCloseTiles();
    }

    unload() {
        this.unloaded = true;
        this.removeAllTiles();
    }

    removeFarTiles() {
        let keys = Object.keys(this.tiles);
        for (let i = 0; i < keys.length; i++) {
            if (!this.tiles.hasOwnProperty(keys[i])) continue;

            let tile = this.tiles[keys[i]];
            if (
                tile.x + this.viewDistanceX < this.centerTile.x ||
                tile.x - this.viewDistanceX > this.centerTile.x ||
                tile.z + this.viewDistanceZ < this.centerTile.y ||
                tile.z - this.viewDistanceZ > this.centerTile.y
            ) {
                tile.unload();
                delete this.tiles[keys[i]];
            }
        }
    }

    removeAllTiles() {
        this.tileMap.setAll(TileMap.EMPTY);

        let keys = Object.keys(this.tiles);
        for (let i = 0; i < keys.length; i++) {
            if (!this.tiles.hasOwnProperty(keys[i])) continue;

            let tile = this.tiles[keys[i]];
            tile.unload();
            delete this.tiles[keys[i]];
        }
    }

    loadCloseTiles = () => {
        if (this.unloaded) return;
        if (!this.loadNextTile()) return;

        if (this.loadTimeout) clearTimeout(this.loadTimeout);

        if (this.currentlyLoading < 4) {
            this.loadTimeout = setTimeout(this.loadCloseTiles, 0);
        } else {
            this.loadTimeout = setTimeout(this.loadCloseTiles, 1000);
        }

    }

    loadNextTile() {
        if (this.unloaded) return;

        let x = 0;
        let z = 0;
        let d = 1;
        let m = 1;

        while (m < Math.max(this.viewDistanceX, this.viewDistanceZ) * 2 + 1) {
            while (2 * x * d < m) {
                if (this.tryLoadTile(this.centerTile.x + x, this.centerTile.y + z)) return true;
                x = x + d;
            }
            while (2 * z * d < m) {
                if (this.tryLoadTile(this.centerTile.x + x, this.centerTile.y + z)) return true;
                z = z + d;
            }
            d = -1 * d;
            m = m + 1;
        }

        return false;
    }

    tryLoadTile(x, z) {
        if (this.unloaded) return;

        if (Math.abs(x - this.centerTile.x) > this.viewDistanceX) return false;
        if (Math.abs(z - this.centerTile.y) > this.viewDistanceZ) return false;

        let tileHash = hashTile(x, z);

        let tile = this.tiles[tileHash];
        if (tile !== undefined) return false;

        this.currentlyLoading++;

        tile = new Tile(x, z, this.handleLoadedTile, this.handleUnloadedTile);
        this.tiles[tileHash] = tile;
        tile.load(this.tileLoader)
            .then(() => {
                this.tileMap.setTile(tile.x - this.centerTile.x + TileManager.tileMapHalfSize, tile.z - this.centerTile.y + TileManager.tileMapHalfSize, TileMap.LOADED);

                if (this.loadTimeout) clearTimeout(this.loadTimeout);
                this.loadTimeout = setTimeout(this.loadCloseTiles, 0);
            })
            .catch(error => {
                if (error.status && error.status === "empty") return;
                if (error.target && error.target.status === 404) return;

                alert(this.events, "Failed to load tile: " + error, "warning");
            })
            .finally(() => {
                this.tileMap.setTile(tile.x - this.centerTile.x + TileManager.tileMapHalfSize, tile.z - this.centerTile.y + TileManager.tileMapHalfSize, TileMap.LOADED);
                this.currentlyLoading--;
            });

        return true;
    }

    handleLoadedTile = tile => {
        //this.tileMap.setTile(tile.x - this.centerTile.x + TileManager.tileMapHalfSize, tile.z - this.centerTile.y + TileManager.tileMapHalfSize, TileMap.LOADED);

        this.scene.add(tile.model);
        this.onTileLoad(tile);
    }

    handleUnloadedTile = tile => {
        this.tileMap.setTile(tile.x - this.centerTile.x + TileManager.tileMapHalfSize, tile.z - this.centerTile.y + TileManager.tileMapHalfSize, TileMap.EMPTY);

        this.scene.remove(tile.model);
        this.onTileUnload(tile);
    }
}