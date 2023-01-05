/*
 * tiled-to-yatssd-class-organized-tileset.js
 *
 * This extension adds the "YATSSD class-organized resource and palette files - regular" type to the "Export As" menu
 *
 * Copyright (c) 2020 Jay van Hutten
 * Copyright (c) 2022 Victor Luchits
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */

function yatssdcHelpers() {
    this.dec = function(v) {
        return v.toString(10);
    };
    
    this.hex = function(v) {
       return "0x" + v.toString(16);
    };
    
    this.hex2 = function(v) {
        return "0x" + v.toString(16).padStart(2, "0");
    };
    
    
    this.cachedImages = new Map();
    this.classes = new Map();
    
    this.getImage = function(imageFilename) {
        if (this.cachedImages.has(imageFilename)) {
            return this.cachedImages.get(imageFilename);
        }
        var newImage = new Image(imageFilename);
        this.cachedImages.set(imageFilename, newImage);
        return newImage;
    }
    
    this.buildTileName = function(baseName, tileClass) {
        let classCount = 0;
        if (this.classes.has(tileClass)) {
            classCount = this.classes.get(tileClass) + 1;
        }
        this.classes.set(tileClass, classCount);
    
        if (tileClass.length > 0) {
            tileClass = "_" + tileClass;
        }

        return baseName + tileClass + "_Res" + this.dec(classCount);
    }
    
    this.buildEmptyTile = function(name, tileset) {
        return this.buildTileResource(name, tileset, null, null, null);
    }
    
    this.buildTileResource = function(name, tileset, tile, image, revColorTable) {
        var tilesetData = "uint8_t "+name+"[] __attribute__((aligned(16))) = {\n"
    
        for (let i = 0; i < tileset.tileHeight; i++)
        {
            for (let j = 0; j <  tileset.tileWidth; j++)
            {
                if (image) {
                    let p = image.pixel(tile.imageRect.x+j, tile.imageRect.y+i)
                    tilesetData += hex2(revColorTable[p])+","
                } else {
                    tilesetData += hex2(0)+","
                }
            }
            tilesetData += "\n"
        }
    
        if (tilesetData.slice(-2) == ",\n")
            tilesetData = tilesetData.slice(0,-2) + "\n";
        tilesetData += "};\n\n"
        return tilesetData;
    }
}


var classOrganizedCustomTilesFormat = {
    name: "YATSSD class-organized tileset and palette",
    extension: "h",

    write:

    function(tileset, filename) {
        console.time("Export completed in");

        let helpers = new yatssdcHelpers();
        // Split full filename path into the filename (without extension) and the directory
        let fileBaseName = FileInfo.completeBaseName(filename).replace(/[^a-zA-Z0-9-_]/g, "_");
        let filePath = FileInfo.path(filename);

        let resourceName = fileBaseName;
        let c = fileBaseName.slice(0, 1)
        if (c >= '0' && c <= '9') {
            resourceName = "_" + resourceName;
        }

        let tilesetImage = tileset.image;

        let primaryImage = helpers.getImage(tilesetImage);
        let colorTable = primaryImage.colorTable();
        let backgroundColor = tileset.backgroundColor;

        let paletteFileData = "";
        paletteFileData += "#ifndef "+resourceName.toUpperCase()+"_PALETTE_H\n";
        paletteFileData += "#define "+resourceName.toUpperCase()+"_PALETTE_H\n\n";
        paletteFileData += "#include <stdint.h>\n";
        paletteFileData += "\n";
        paletteFileData += "const uint8_t "+resourceName+"_Palette[] __attribute__((aligned(16))) = {\n";

        let lastind = 0;
        for (let [ind, value] of Object.entries(colorTable)) {
            let rgb = [];

            if (ind == 0 && backgroundColor)
            {
                value = parseInt(backgroundColor.toString().slice(1),16);
            }

            rgb.push(helpers.hex2((value >> 16) & 0xff));
            rgb.push(helpers.hex2((value >> 8 ) & 0xff));
            rgb.push(helpers.hex2((value >> 0 ) & 0xff));
            paletteFileData += rgb.join(",")+",\n";
            lastind = ind;
        }
        for (; lastind < 256; lastind++)
        {
            paletteFileData += "0x0,0x0,0x0,\n";
        }

        if (paletteFileData.slice(-2) == ",\n")
            paletteFileData = paletteFileData.slice(0,-2) + "\n";
        paletteFileData += "};\n";
        paletteFileData += "\n#endif\n";

        let revColorTable = {};
        for (const [ind, value] of Object.entries(colorTable)) {
            revColorTable[value] = ind | 0
        }

        let resourceFileData = "";
        resourceFileData += "#ifndef "+resourceName.toUpperCase()+"_H\n";
        resourceFileData += "#define "+resourceName.toUpperCase()+"_H\n\n";
        resourceFileData += "#include <stdint.h>\n";
        resourceFileData += "\n";

        let tilesetData = "";

        let id = 0
        let res = []

        // Inject empty dummy tile
        let name = helpers.buildTileName(resourceName, "EmptyTile");
        res.push(name)
        tilesetData += helpers.buildEmptyTile(name, tileset);

        for (let tx = 0; tx < tileset.tiles.length; tx++)
        {
            let tile = tileset.tiles[tx];
            if (!tile) {
                continue;
            }
            var image = tile.imageFileName ? helpers.getImage(tile.imageFileName) : primaryImage;
            let name = helpers.buildTileName(resourceName, tile.className);
            res.push(name)

            tilesetData += helpers.buildTileResource(name, tileset, tile, image, revColorTable);

            id += 1
        }

        resourceFileData += tilesetData + "\n";

        resourceFileData += "const uint8_t * "+resourceName+"_Reslist[] = {\n";
        resourceFileData += res.join(",\n");
        resourceFileData += "\n};\n";

        resourceFileData += "\n#endif\n";

        // Write header data to disk
        let headerFile = new TextFile(FileInfo.joinPaths(filePath,fileBaseName+".h"), TextFile.WriteOnly);
        headerFile.write(resourceFileData);
        headerFile.commit();

        let paletteFile = new TextFile(FileInfo.joinPaths(filePath,fileBaseName+"_palette.h"), TextFile.WriteOnly);
        paletteFile.write(paletteFileData);
        paletteFile.commit();

        console.log("Tileset exported to "+FileInfo.joinPaths(filePath,fileBaseName+".h"));

        console.timeEnd("Export completed in");
    }
}

tiled.registerTilesetFormat("yatssdclass", classOrganizedCustomTilesFormat)
