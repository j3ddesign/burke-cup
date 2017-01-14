/**
 * Created by thoms on 1/14/2017.
 */
'use strict';
//New Stuff
const _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

$(function () {

    //Play first alert on load
    const debug = true;

    let muted = true;

    // PIXI and P2
    let renderer, stage, container, world, debugDrawGraphics;


    // Active in scene
    let gems = [],
        messages = [],
        fireQ = [];


    // Pending
    let queuedAlert = [];

    // Track message;
    let messageID = 0;
    let needsDepthSort = false;

    let needDepthSort = false;


    let gemAnimationFrames = {};
    let gemFlashFrames = {};
    let gemMaterial = new p2.Material();
    let chestMaterial = new p2.Material();


    // Globals
    const width = $('body').width();
    const height = $('body').height();


    // Chest width/height. Sprites will be scaled to fit this
    let chestWidth = 225;
    let chestHeight = 211;

    let chestPosition =  [width - 150, 0]; // Left side of the screen;
    let chestRadiusAdjust = 10;
    let chestRightAdjust = 5;
    let chestBottomHeight = 5;
    let chestSideLength = 9;
    let chestSideThickness = 215;

    let cannon,
        cannonIsMoving = false,
        cannonVisible = false,
        cannonExiting = false;

    let MAXIMUM_TEXT_DISPLAY = 50;
    let TEXT_DISPLAY_START = height - 50;
    let GEM_DROP_POINT = width - 400;
    let GEM_RADIUS = 12;

    stage = new PIXI.Container();

    function webGLDetect(return_context) {
        if (window.WebGLRenderingContext) {
            var canvas = document.createElement('canvas'),
                names = ['webgl', 'experimental-webgl', 'moz-webgl', 'webkit-3d'],
                context = false;

            for (var i = 0; i < 4; i++) {
                try {
                    context = canvas.getContext(names[i]);
                    if (context && typeof context.getParameter === 'function') {
                        // WebGL is enabled
                        if (return_context) {
                            // return WebGL object if the function's argument is present
                            return { name: names[i], gl: context };
                        }
                        // else, return just true
                        return true;
                    }
                } catch (e) {
                    console.log(e);
                }
            }

            // WebGL is supported, but disabled
            return false;
        }

        // WebGL not supported
        return false;
    }

    function addBoundingBox() {

        // Bottom
        let chestBottom = new p2.Body({
            position: [chestPosition[0],
                chestPosition[1]]
        });
        chestBottom.addShape(new p2.Box({
            width: chestWidth,
            height: chestBottomHeight,
            material: chestMaterial
        }));

        // Left
        let chestLeft = new p2.Body({
            position: [chestPosition[0] - chestWidth / 2.1,
                chestPosition[1] + chestRadiusAdjust]
        });
        chestLeft.addShape(new p2.Box({
            width: chestSideLength * 2,
            height: chestSideThickness,
            material: chestMaterial
        }));

        // Right
        let chestRight = new p2.Body({
            position: [chestPosition[0] + chestWidth / 2.1,
                chestPosition[1] + chestRadiusAdjust]
        });
        chestRight.addShape((new p2.Box({
            width: chestSideLength * 2,
            height: chestSideThickness,
            material: chestMaterial
        })));

        world.addBody(chestBottom);
        world.addBody(chestLeft);
        world.addBody(chestRight);
    }

    function addChestBackground() {
        let chestBack = new PIXI.Sprite.fromImage('assets/images/trans_background.png');
        chestBack.position.x = chestPosition[0] - chestWidth / 2;
        chestBack.position.y = height - chestPosition[1] - chestHeight + 7;
        chestBack.height = chestHeight; // Need to set;
        chestBack.width = chestWidth; // Need to set

        stage.addChild(chestBack);
    }

    function addChestFront() {
        let chestFront = new PIXI.Sprite.fromImage('assets/images/trans_foreground.png');
        chestFront.position.x = chestPosition[0] - chestWidth / 2;
        chestFront.position.y = height - chestPosition[1] - chestHeight;
        chestFront.height = chestHeight; // Need to set;
        chestFront.width = chestWidth; // Need to set

        stage.addChild(chestFront);
    }

    function addCannon() {
        cannon = new PIXI.Sprite.fromImage('assets/images/cannon.png');
        cannon.height = 259;
        cannon.width = 118;
        cannon.position.x = 0;
        cannon.scale.y *= -1;
        cannon.position.y = height - chestPosition[1] - (chestHeight / 2) + 20;

        cannon.rotation = -2.3

        stage.addChild(cannon);
    }

    function moveCannon(way) {
        //console.log(way, cannon.position.x, (cannon.width * 2 + 50));
        if(way === 'left') {
            if(cannon.position.x >= (cannon.width * 2) * -1) {
                cannon.position.x -= 5;
            }else{
                cannon.position.x -= 5;
                cannonExiting = false;
                cannonVisible = false;
                cannonIsMoving = false;
            }
        }

        if(way === 'right') {
            if(cannon.position.x >= cannon.width * 2){
                cannonIsMoving = false;
            }else{
                cannon.position.x += 5;

            }
        }
    }

    function randomRange(low, high) {
        return Math.random() * (high - low) + low;
    }

    function rotation(mag, rad) {
        return [Math.cos(rad) * mag, Math.sin(rad) * mag];
    }

    let Gem = function () {
        function Gem(physical, renderable, animationFrames, tier, amount) {
            _classCallCheck(this, Gem);

            this.physical = physical;
            this.renderable = renderable;

            // Set to true when the gem begins falling under the influence of gravity.
            this.falling = false;

            this.inChest = false;
            // This is roughly how many game frames it takes the gem animation to complete.
            this.startingGemAnimationGameFrames = animationFrames;

            // A counter to count frames until the gem animation is done.
            this.gemAnimationGameFrames = 0;

            this.tier = tier;

            this.amount = amount;
        }

        _createClass(Gem, [{
            key: 'sync',
            value: function sync() {
                setPointFromPosition(this.renderable.position, this.physical.position);
                this.renderable.rotation = this.physical.angle;
            }
        }, {
            key: 'updateAnimationFrames',
            value: function updateAnimationFrames() {
                if (this.gemAnimationGameFrames > 0) {
                    this.gemAnimationGameFrames--;
                    if (this.gemAnimationGameFrames === 0) {
                        container.removeChild(this.renderable);

                        // Transform this gem into a flashing gem.
                        var glimmerFrames = gemFlashFrames[this.tier];
                        var gem = new PIXI.extras.MovieClip(glimmerFrames);
                        gem.animationSpeed = 24 / 60;
                        gem.gotoAndPlay(Math.floor(randomRange(0, gem.totalFrames)));
                        gem.scale = this.renderable.scale;
                        gem.anchor.x = 0.5;
                        gem.anchor.y = 0.5;
                        gem.depth = this.renderable.depth;

                        container.addChild(gem);
                        this.renderable = gem;
                        needsDepthSort = true;
                    }
                }
            }
        }, {
            key: 'update',
            value: function update(dt) {
                this.updateAnimationFrames();



                if (this.falling) {


                    //this.physical.velocity =  rotation(0.5 * dt), rotation(0.5 * dt)
                    // Die when the gem falls out of bounds.
                    if (this.physical.position[0] < 0 - GEM_RADIUS || this.physical.position[0] > width + GEM_RADIUS || this.physical.position[1] < 0 - GEM_RADIUS) {
                        this.dead = true;
                    }

                    if (this.falling && this.physical.position[1] < TEXT_DISPLAY_START - 40 * (MAXIMUM_TEXT_DISPLAY - 45) && !this.hasRenderBody) {
                        var gemShape = new p2.Circle({ radius: GEM_RADIUS, material: gemMaterial });
                        this.physical.addShape(gemShape);
                        this.hasRenderBody = true;
                        setTimeout(function() {
                          fireQ.pop();
                        },2000);
                    }
                    if (this.physical.mass >= this.tier && this.physical.mass > 0) {
                     this.physical.mass = this.physical.mass - dt * this.tier;
                     this.physical.updateMassProperties();
                     }
                }
                else {
                    // Update the position, and then turn on physics when we hit the rim of the cup.
                    //this.physical.position[0] += dt * 150;


                    // Start playing the animation and sound when the gem is on screen.
                    if (this.physical.position[0] < cannon.position.x && this.gemAnimationGameFrames === 0 && this.falling === false) {
                        this.gemAnimationGameFrames = this.startingGemAnimationGameFrames;
                        this.renderable.gotoAndPlay(0);

                        if (!muted && this.amount >= muteLessThan) {
                            var sfx = $('.js-gem-sound-' + this.tier).clone()[0];
                            if (this.amount < 100) {
                                sfx.volume = 0.05;
                            } else {
                                sfx.volume = 0.15;
                            }
                            sfx.play();
                        }
                    }
                    // Once it reaches the drop point, let physics happen.
                    if (this.physical.position[0] > GEM_DROP_POINT && this.falling === false) {
                      this.physical.updateMassProperties();
                      this.falling = true;
                    }
                }
            }
        }, {
            key: 'destroy',
            value: function destroy() {
                world.removeBody(this.physical);
                container.removeChild(this.renderable);
                this.renderable.destroy();
            }
        }]);

        return Gem;
    }();

    let ScrollingText = function () {
        function ScrollingText(rank, renderables) {
            _classCallCheck(this, ScrollingText);

            this.rank = rank;
            this.renderables = renderables;
        }

        _createClass(ScrollingText, [{
            key: 'update',
            value: function update(dt) {
                for (var i = 0; i < this.renderables.length; ++i) {
                    this.renderables[i].position.y -= dt * 100;
                }

                // Kill this object when the last member goes offscreen.
                var last = this.renderables[this.renderables.length - 1];
                if (last.width + last.position.y < 0) {
                    this.dead = true;
                }
            }
        }, {
            key: 'destroy',
            value: function destroy() {
                _.each(this.renderables, function (r) {
                    container.removeChild(r);
                    r.destroy();
                });
            }
        }]);

        return ScrollingText;
    }();


    function addGem(x, y, tier, depth, amount) {
        // Add a box
        /*
        There are a few different ways to shoot this bitch
        Low Arc shot
        x: 375
        y: 200
        cannon.rotation = -1.7;

        Medium
        x:250
        y: 300
        cannon.rotation = -2.3

        High Arc Shot
        x: 200
        y: 400

         Math.floor((Math.random() * 232) + 230)

         */

        let xVel, yVel;

        xVel = 250;
        yVel = 300
        cannon.rotation = -2.3;
        setTimeout(function() {

            cannon.position.y = cannon.position.y + 10;
            cannon.position.x = cannon.position.x - 5;
            setTimeout(function() {
              cannon.position.y = cannon.position.y - 10;
              cannon.position.x = cannon.position.x + 5;
            },250)
        },50)
        //Push new bullet into cannon
        fireQ.push(1);

        let body = new p2.Body({
          mass: Math.floor(Math.random() * tier + amount),
          damping: 0.01,
          type: p2.Body.DYNAMIC,
          angularDamping: 0.7,
          position: [x, y - GEM_RADIUS],
          velocity: [xVel, yVel],
          angularVelocity: -1
        });

        world.addBody(body);

        var animationFrames = gemAnimationFrames[tier];
        var gem = new PIXI.extras.MovieClip(animationFrames);
        gem.animationSpeed = 24 / 60;
        gem.play();
        gem.anchor.x = 0.5;
        gem.anchor.y = 0.5;

        // The gems are slightly larger than the collision body, so overlaps will happen.
        gem.scale = new PIXI.Point(GEM_RADIUS * 4 / gem.width, GEM_RADIUS * 4 / gem.width);
        gem.depth = depth;

        // The scaling factor of 60 / 24 * 3 was experimentally derived.
        var gemMovieGameFrames = Math.ceil(gem.totalFrames * 60 / 24 * 3);

        // Add the box to our container
        container.addChild(gem);

        var res = new Gem(body, gem, gemMovieGameFrames, tier, amount);
        gems.push(res);

        needsDepthSort = true;
        return res;
    }


    function addAlert(user, msg, emotes, bits) {
        cannonVisible = true;
        cannonExiting = false;
        cannonIsMoving = true;

        queuedAlert.push({
            user: user,
            message: msg,
            emotes: emotes,
            bits: bits
        });
    }

    function getPointsThreshold(amount) {
        // Points threshold.
        var threshold = 1;
        if (amount >= 10000) {
            threshold = 10000;
        } else if (amount >= 5000) {
            threshold = 5000;
        } else if (amount >= 1000) {
            threshold = 1000;
        } else if (amount >= 100) {
            threshold = 100;
        }

        return threshold;
    }

    function createText() {
        let i, j;

        // Return if nothing queued
        if (queuedAlert.length === 0) return;

        // Find an open lane.
        var exists = {};
        for (i = 0; i < messages.length; ++i) {
            exists[messages[i].rank] = 1;
        }
        var nextRank = undefined;
        for (i = 0; i < MAXIMUM_TEXT_DISPLAY; ++i) {
            if (exists[i] === undefined) {
                nextRank = i;
                break;
            }
        }

        if (nextRank === undefined) return;

        let text = queuedAlert[0];
        queuedAlert.splice(0, 1);

        // This is a list of { emote-id, indices: [start, end] }
        var emoteListing = [];

        // Split the emotes field on /
        text.emotes = text.emotes || '';
        if (text.emotes !== '') {
            let emotes = text.emotes.split('/');
            for (i = 0; i < emotes.length; ++i) {
                // Invert this index, turning it into starting-char -> emote id, length.
                let data = emotes[i];
                let idSplit = data.split(':');
                let values = idSplit[1].split(',');

                // Turn the values into integer pairs of start and ending points.
                let _indices = _.map(values, function (v) {
                    let indices = v.split('-');
                    return [parseInt(indices[0], 10), parseInt(indices[1], 10)];
                });

                // Add each emote index pair to the list.
                _.each(_indices, function (v) {
                    emoteListing.push({
                        id: idSplit[0],
                        indices: v
                    });
                });
            }
        }

        // This sorts the emotes from first to last in order of appearance.
        emoteListing = _.sortBy(emoteListing, function (a) {
            return a.indices[0];
        });

        // Then reverse them, since replacing the last emote does not change indices of prior emotes.
        emoteListing = emoteListing.reverse();
        let replaceRange = function replaceRange(msg, b, e) {
            return msg.substr(0, b) + '\x01' + msg.substr(e + 1);
        };

        let message = text.message;
        for (i = 0; i < emoteListing.length; ++i) {
            let range = emoteListing[i];
            message = replaceRange(message, range.indices[0], range.indices[1]);
        }

        // Split on 0x01, which gives us a set of messages seperated by emotes.
        let splitMessage = message.split('\x01');
        let givepointsRegex = /(?:^|\s)cheer(\d+)(?=$|\s)/g;
        let amountRegex = /(?:^|\s)cheer(\d+)(?=$|\s)/;

        // Begin assembling the {prefix, emote} table.
        let messageTable = [];
        let forwardEmoteListing = emoteListing.reverse();

        // At the end there is a sentinel '0' emote, which is no emote.
        forwardEmoteListing.push({
            id: '0'
        });

        let total = 0;
        let expected = text.bits;

        // At this point, splitMessage is a list of text fragments. Between each fragment is an emote.
        for (i = 0; i < splitMessage.length; ++i) {
            let part = splitMessage[i];

            // Then, look for givepoints objects
            let matches = part.match(givepointsRegex);
            let splits = part.replace(givepointsRegex, '\x01').split('\x01');

            // Splits is now a list of text fragments, between each of which is a givepoints command.
            for (j = 0; j < splits.length - 1; ++j) {
                let matchResults = matches[j].match(amountRegex);
                let amount = parseInt(matchResults[1], 10);

                if (total + amount > expected) {
                    // Skip this one, as it exceeds the number of bits in the message.
                    messageTable.push({
                        prefix: splits[j].trim() + matches[j],
                        emote: { id: '0' }
                    });
                } else {
                    // Push each fragment, with a gem afterwards.
                    messageTable.push({
                        prefix: splits[j].trim(),
                        emote: { id: '-1' },
                        amount: amount
                    });

                    total += amount;
                }
            }

            // Push the final message, with the emote afterwards.
            messageTable.push({
                prefix: splits[splits.length - 1].trim(),
                emote: forwardEmoteListing[i]
            });
        }

        // Prepend the username.
        if(!debug){
          messageTable[0].prefix = text.user + ': ' + messageTable[0].prefix;
        } else{
          messageTable[0].prefix = text.user + ' ' + messageTable[0].prefix;
        }


        // Begin constructing the display objects.
        let resultingTextObjects = [];
        let properties = { font: '24px Arial', fill: 0xFFFFFF, stroke: 0x000000, strokeThickness: 5, align: 'left', lineJoin: 'round' };
        let currentOffset = width + 100;
        let textHeight = TEXT_DISPLAY_START - 40 *nextRank;

        for (i = 0; i < messageTable.length; ++i) {
            let msg = messageTable[i];

            // If there is a non-empty prefix, generate a text object.
            if (msg.prefix.length !== 0) {
                let textDisplay = new PIXI.Text(msg.prefix, properties);
                textDisplay.scale = new PIXI.Point(1, -1);
                textDisplay.position = new PIXI.Point((width / 2) - (textDisplay.width / 2), height);

                container.addChild(textDisplay);
                currentOffset += textDisplay.width;
                resultingTextObjects.push(textDisplay);
            }

            if (msg.emote.id === '-1') {
                // If the emote is a gem, add a gem.
                let tier = getPointsThreshold(msg.amount);
                addGem(225, 130, tier, messageID * 10000 + tier + i, msg.amount);
                currentOffset += GEM_RADIUS * 2 + 10;
            } else if (msg.emote.id === '0') {
                // Do nothing.
            } else {
                // This is an emote, construct a sprite.
                let emoteDisplay = new PIXI.Sprite.fromImage('/points/emote/' + msg.emote.id);
                emoteDisplay.scale = new PIXI.Point(1, -1);

                // These pixel adjustments were experimentally derived.
                emoteDisplay.position = new PIXI.Point(width / 2, height + textHeight);
                currentOffset += 38;

                container.addChild(emoteDisplay);
                resultingTextObjects.push(emoteDisplay);
            }
        }

        messages.push(new ScrollingText(nextRank, resultingTextObjects));
        messageID++;
        needsDepthSort = true;
    }

    function clearAllGems() {
        _.each(gems, function (g) {
            g.dead = true;
        });
    }

    function setPointFromPosition(point, position) {
        point.x = position[0];
        point.y = position[1];
    }

    function update(dt) {

        if(cannonVisible === true && cannonIsMoving === true && cannonExiting === true) {
            cannonExiting = false;
        }

        if(needDepthSort){
            container.children.sort(depthSort);
            needDepthSort = false;
        }

        gems = _.filter(gems, function(g) {
            if(g.dead){
                g.destroy();
            }
            return !g.dead;
        });

        if(gems.length > 0){
            for(let i = 0; i < gems.length; i++){
                gems[i].update(dt);
                gems[i].sync();
            }

        }

        messages = _.filter(messages, function(t){
            if(t.dead) {
                t.destroy();
            }
            return !t.dead;
        });

        if(messages.length < MAXIMUM_TEXT_DISPLAY && cannonVisible === true && cannonIsMoving === false){
            createText();
        }


        for(let i = 0; i < messages.length; i++){
            messages[i].update(dt);
        }


        if(cannonVisible === true){
          if(fireQ.length === 0 && cannonIsMoving === false){
             cannonExiting = true;
          }

            if(cannonExiting === true && cannonIsMoving === false){
                moveCannon('left');
            }

            if(cannonIsMoving === true && cannonExiting === false){
                moveCannon('right');
            }

        }
    }

    function debugRenderWorld(world, renderer) {
        renderer.clear();

        var colors = [0x000000, 0xFFFF00, 0x1CE6FF, 0xFF34FF, 0xFF4A46, 0x008941, 0x006FA6, 0xA30059, 0xFFDBE5, 0x7A4900, 0x0000A6, 0x63FFAC, 0xB79762, 0x004D43, 0x8FB0FF, 0x997D87, 0x5A0007, 0x809693, 0xFEFFE6, 0x1B4400, 0x4FC601, 0x3B5DFF, 0x4A3B53, 0xFF2F80, 0x61615A, 0xBA0900, 0x6B7900, 0x00C2A0, 0xFFAA92, 0xFF90C9, 0xB903AA, 0xD16100, 0xDDEFFF, 0x000035, 0x7B4F4B, 0xA1C299, 0x300018, 0x0AA6D8, 0x013349, 0x00846F, 0x372101, 0xFFB500, 0xC2FFED, 0xA079BF, 0xCC0744, 0xC0B9B2, 0xC2FF99, 0x001E09, 0x00489C, 0x6F0062, 0x0CBD66, 0xEEC3FF, 0x456D75, 0xB77B68, 0x7A87A1, 0x788D66, 0x885578, 0xFAD09F, 0xFF8A9A, 0xD157A0, 0xBEC459, 0x456648, 0x0086ED, 0x886F4C, 0x34362D, 0xB4A8BD, 0x00A6AA, 0x452C2C, 0x636375, 0xA3C8C9, 0xFF913F, 0x938A81, 0x575329, 0x00FECF, 0xB05B6F, 0x8CD0FF, 0x3B9700, 0x04F757, 0xC8A1A1, 0x1E6E00, 0x7900D7, 0xA77500, 0x6367A9, 0xA05837, 0x6B002C, 0x772600, 0xD790FF, 0x9B9700, 0x549E79, 0xFFF69F, 0x201625, 0x72418F, 0xBC23FF, 0x99ADC0, 0x3A2465, 0x922329, 0x5B4534, 0xFDE8DC, 0x404E55, 0x0089A3, 0xCB7E98, 0xA4E804, 0x324E72, 0x6A3A4C];

        var rotate = function rotate(v, rads) {
            var c = Math.cos(rads);
            var s = Math.sin(rads);

            return [c * v[0] - s * v[1], s * v[0] + c * v[1]];
        };

        for (var bi in world.bodies) {
            var body = world.bodies[bi];

            renderer.beginFill(colors[bi], 1);
            for (var si in body.shapes) {
                var shape = body.shapes[si];
                switch (shape.type) {
                    case p2.Shape.CIRCLE:
                        renderer.drawCircle(shape.position[0] + body.position[0], height - (shape.position[1] + body.position[1]), shape.radius);
                        break;
                    case p2.Shape.CONVEX:
                        var verts = [];
                        var rotatedPosition = rotate(shape.position, body.angle);
                        for (var i = 0; i < shape.vertices.length; ++i) {
                            var rotated = rotate(shape.vertices[i], body.angle);

                            verts.push(rotatedPosition[0] + body.position[0] + rotated[0]);
                            verts.push(height - (rotatedPosition[1] + body.position[1] + rotated[1]));
                        }
                        renderer.drawPolygon(verts);
                        break;
                    default:
                        console.log(body.shapes[si]);
                        break;
                }
            }
            renderer.endFill();
        }
    }

    function init() {

        world = new p2.World({
            gravity: [0, -98.20]
        });

        world.addContactMaterial(new p2.ContactMaterial(gemMaterial, gemMaterial, { relaxation: 0.8, friction: 0, restitution: 0.2, stiffness: p2.Equation.DEFAULT_STIFFNESS * 100 }));
        world.addContactMaterial(new p2.ContactMaterial(gemMaterial, chestMaterial, { relaxation: 0.8, friction: 0, restitution: 0.2, stiffness: Number.MAX_VALUE }));




        // Initialize the stage
        if(webGLDetect()) {
            renderer = new PIXI.WebGLRenderer(width, height, { transparent: true });
        } else {
            renderer = new PIXI.CanvasRenderer(width, height, { transparent: true });
        }

        stage = new PIXI.Container();

        // Add Chest Background
        addChestBackground();

        container = new PIXI.Container(), container.scale.y = -1;
        stage.addChild(container);

        container.position.y = renderer.height;

        document.body.appendChild(renderer.view);

        // Add Chest Foreground
        addChestFront();

        // Add Cannon
        addCannon();

        debugDrawGraphics = new PIXI.Graphics();
        stage.addChild(debugDrawGraphics);
        addBoundingBox();
        PIXI.loader.add('assets/images/point-sprites/1-quarter.json').add('assets/images/point-sprites/100-quarter.json').add('assets/images/point-sprites/1000-quarter.json').add('assets/images/point-sprites/5000-quarter.json').add('assets/images/point-sprites/10000-quarter.json').load(function () {
            var breakPoints = [1, 100, 1000, 5000, 10000];
            var glimmerStart = [43, 43, 43, 43, 43];
            var frames = [64, 64, 64, 64, 73];

            var frameName = function frameName(name, i) {
                var frameID = '' + i;
                if (i < 10) {
                    frameID = '0' + i;
                }

                return name + '_000' + frameID;
            };

            for (var movie = 0; movie < breakPoints.length; ++movie) {
                var name = breakPoints[movie];
                var frameCount = frames[movie];
                var glimmerStartFrame = glimmerStart[movie];

                var fullFrames = [];
                for (var i = 0; i < frameCount; ++i) {
                    fullFrames.push(PIXI.Texture.fromFrame(frameName(name, i)));
                }

                var glimmerFrames = [];
                for (i = glimmerStartFrame; i < frameCount; ++i) {
                    glimmerFrames.push(PIXI.Texture.fromFrame(frameName(name, i)));
                }

                // Add in like, 2 seconds of blankness.
                for (i = 0; i < 150; ++i) {
                    glimmerFrames.push(PIXI.Texture.fromFrame(frameName(name, frameCount - 1)));
                }

                gemAnimationFrames[name] = fullFrames;
                gemFlashFrames[name] = glimmerFrames;
            }

            animate();
            unserializeState();
        });


    }


    // Animation Loop
    let start = 0;
    let accumulate = 0;
    var frameNumber = 0;

    function animate(t) {
        t = t || 0;
        var dt = t - start;

        accumulate += dt;

        var updates = 0;
        while (accumulate > 1 / 60 && updates < 3) {
            world.step(1 / 60);
            update(1 / 60, frameNumber++);

            accumulate -= 1 / 60;
            updates++;
        }

        if (getQueryParameter('physicsrender')) {
            debugRenderWorld(world, debugDrawGraphics);
        }

        start = t;
        requestAnimationFrame(animate);

        // Render scene
        renderer.render(stage);
    }

    // Gem State Serialization
    function serializeState() {
        var result = [];
        for (var i = 0; i < gems.length; ++i) {
            var gem = gems[i];
            result.push({
                position: gem.physical.position,
                falling: gem.falling,
                velocity: gem.physical.velocity,
                mass: gem.physical.mass,
                angularVelocity: gem.physical.angularVelocity,
                angle: gem.physical.angle,
                tier: gem.tier,
                depth: gem.renderable.depth
            });
        }

        localStorage.setItem('gem_state', JSON.stringify(result));
    }

    function unserializeState() {
        var state = JSON.parse(localStorage.getItem('gem_state'));
        if (state === null) {
            return;
        }

        for (var i = 0; i < state.length; ++i) {
            var data = state[i];

            var gemShape = new p2.Circle({ radius: GEM_RADIUS, material: gemMaterial });
            var body = new p2.Body({
                mass: data.mass,
                position: [data.position[0], data.position[1]],
                angularVelocity: data.angularVelocity,
                velocity: [data.velocity[0], data.velocity[1]],
                angle: data.angle,
                damping: 0.1,
                angularDamping: 0.1
            });

            body.addShape(gemShape);
            world.addBody(body);

            var gem = new PIXI.extras.MovieClip(gemFlashFrames[data.tier]);
            gem.animationSpeed = 24 / 60;
            gem.gotoAndPlay(Math.floor(randomRange(0, gem.totalFrames)));
            gem.scale = new PIXI.Point(GEM_RADIUS * 4 / gem.width, GEM_RADIUS * 4 / gem.width);
            gem.anchor.x = 0.5;
            gem.anchor.y = 0.5;
            gem.depth = data.depth;

            container.addChild(gem);

            var res = new Gem(body, gem, 0, data.tier, data.depth, data.amount);
            res.falling = data.falling;

            gems.push(res);
        }

        needsDepthSort = true;
        messageID = state.length + 1;
    }

    // Look for any parameters
    let getQueryParameter = function getQueryParameter(p) {
        let urlHashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for (var i = 0; i < urlHashes.length; i++) {
            var hash = urlHashes[i].split('=');
            if (hash[0] === p) {
                return hash[1] || true;
            }
        }
    };

    // Enable Debug mode ?debug=true
    if(getQueryParameter('debug')){
        console.log('%c' + ` ################ Debug Mode Started ################## `, 'color:white;background:#1976d2;font-weight:bold;')
        console.log(`
1. Keys 1 - 5 will activate the different gem drops
2. Keys 6 - 0 will activate the different emote drops
3. Space key will erase all bits active
         `);
        console.log('%c' + ` ###################################################### `, 'color:white;background:#1976d2;font-weight:bold;')
        $('body').on('keypress', function(k){
            let charCode = k.which ? k.which : k.keyCode;
            let val = 0;
            let msg = 'cheer';
            let usr = '';

            switch (String.fromCharCode(charCode)){
                case '1':
                    val = 1;
                    break;
                case '2':
                    val = 101;
                    break;
                case '3':
                    val = 1001;
                    break;
                case '4':
                    val = 5240;
                    break;
                case '5':
                    val = 10000;
                    break;
                case ' ':
                    clearAllGems();
                    return;
                default:
                    return;
            }
            cannonVisible = true;
            cannonIsMoving = true;
            //addGem(250, 150, val, Math.floor((Math.random() * 9999) + 100000) + '1' + 1, val);
            addAlert(usr,`${msg}${val}`, '', val);




        });

    }




    init();
}); // End
