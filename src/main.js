import { Game } from "../lib/game.js";
import { updateInput, isActionPressed, isActionReleased, isActionJustPressed } from "../lib/input.js";
import { Vector2, lerp, randomInt } from "../lib/math.js";
import { AudioStream } from "../lib/audio.js";
import { RectangleCollisionShape2D, checkCollision } from "../lib/physics.js";
import { fillArray, shapeArray, shuffle } from "../lib/utils.js";

// Each layer is a canvas element;
Game.createWindow(320, 180, 3);
Game.addLayer("main", 1, false);
Game.addLayer("particle", 2);
Game.addLayer("peek", 3);
Game.addLayer("ui", 4);

let layers = Game.layers;

let urls = {
    start1: "./src/assets/sprites/startscreen1.png",
    start2: "./src/assets/sprites/startscreen2.png",
    start3: "./src/assets/sprites/startscreen3.png",
    credits1: "./src/assets/sprites/credits1.png",
    credits2: "./src/assets/sprites/credits2.png",
    bg1: "./src/assets/sprites/background1.png",
    bg2: "./src/assets/sprites/background2.png",
    redBoard: "./src/assets/sprites/boardbg1.png",
    greenBoard: "./src/assets/sprites/boardbg2.png",
    blueBoard: "./src/assets/sprites/boardbg3.png",
    frame: "./src/assets/sprites/frame.png",
    tileFrame: "./src/assets/sprites/tileframe.png",
};

// Import image files to be used as textures in game;
await Game.preloadAll(urls)
let textures = Game.textures;


let sfxMoveTile = new AudioStream("./src/assets/sound/move1.wav");
let sfxBlockedTile = new AudioStream("./src/assets/sound/block1.wav");
let sfxUiClick = new AudioStream("./src/assets/sound/select1.wav");


class Tile {
    constructor(id, texture, x, y, tileRow, tileCol, tileSize) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.tileRow = tileRow;
        this.tileCol = tileCol;
        this.tileSize = tileSize;
        this.emptyTile = boardSize * boardSize;
        
        this.texture = texture;
        this.textureX = x,
        this.textureY = y,

        this.collider = new RectangleCollisionShape2D(this.x, this.y, this.tileSize, this.tileSize);

        this.animPlaying = false;
        this.animProgress = 0;        
        this.animParameter;
        this.target;
    }
    
    move(board) {
        // Move is called while previous move animation is playing, so end the animation first;
        if (this.animPlaying) {
            this.endAnimation();
        }

        let row = this.tileRow;
        let col = this.tileCol;

        // Check around the tile for open positions;
        let openLeft   = col > 0 && board[row][col - 1] === this.emptyTile;
        let openRight  = col < boardSize - 1 && board[row][col + 1] === this.emptyTile;
        let openTop    = row > 0 && board[row - 1][col] === this.emptyTile;
        let openBottom = row < boardSize - 1 && board[row + 1][col] === this.emptyTile;

        // If position is open, start movement animation,
        // Swap ids in the board and update row / col;
        if (openLeft) {
            this.startAnimation("x", this.x - tileSize);

            board[row][col - 1] = this.id;
            board[row][col] = this.emptyTile;
            
            this.tileCol = col - 1;

            sfxMoveTile.play(sfxVolume);
        } else if (openRight) {
            this.startAnimation("x", this.x + tileSize);

            board[row][col + 1] = this.id;
            board[row][col] = this.emptyTile;
            
            this.tileCol = col + 1;

            sfxMoveTile.play(sfxVolume);
        } else if (openTop) {
            this.startAnimation("y", this.y - tileSize);

            board[row - 1][col] = this.id;
            board[row][col] = this.emptyTile;
            
            this.tileRow = row - 1;

            sfxMoveTile.play(sfxVolume);
        } else if (openBottom) {
            this.startAnimation("y", this.y + tileSize);

            board[row + 1][col] = this.id;
            board[row][col] = this.emptyTile;
            
            this.tileRow = row + 1;
            
            sfxMoveTile.play(sfxVolume);
        } else {
            sfxBlockedTile.play(sfxVolume);
        }
    }

    startAnimation(parameter, target) {
        this.animParameter = parameter;
        this.target = target;
        this.animProgress = 0;        
        this.animPlaying = true;
    }

    endAnimation() {
        this.animPlaying = false;

        if (this.animParameter === "x") {
            this.x = this.target;
        } else if (this.animParameter === "y") {
            this.y = this.target;
        }

        this.collider.updatePosition(new Vector2(this.x, this.y));
    }
    
    animate() {
        // While animation is playing, every frame will increment the progress to be used in lerp;
        if (this.animParameter === "x") {
            this.x = lerp(this.x, this.target, this.animProgress, "easeOutElastic");
            this.animProgress += 1/200;
        } else if (this.animParameter === "y") {
            this.y = lerp(this.y, this.target, this.animProgress, "easeOutElastic");
            this.animProgress += 1/200;
        }

        if (this.animProgress > 1) {
            this.animPlaying = false;
        }

        this.collider.updatePosition(new Vector2(this.x, this.y));
    }

    draw(ctx) {
        // Empty tile will always be blank and without updated x and y, so don't even show it;
        if (this.id === this.emptyTile) {
            return;
        }
        
        ctx.drawImage(this.texture, 
            this.textureX - boardX, this.textureY - boardY, 
            this.tileSize, this.tileSize, 
            this.x, this.y, 
            this.tileSize, this.tileSize)
            
        // this.drawIds(ctx);
    }
    drawIds(ctx) {
        ctx.fillStyle = "white";
        ctx.font = "16px m6x11";
        ctx.fillText(this.id, this.x + tileSize/2, this.y + tileSize/2 + 2);
    }
}


let gameStarted = false; 

let boardResolution = 128
let boardX = Game.width / 2 - boardResolution / 2;
let boardY = 18;
let boardSize = 4;

let tileSize = boardResolution / boardSize;

let activeBoard = "red";
let activeBoardTexture = textures.redBoard;

let redBoard = [];
let greenBoard = [];
let blueBoard = [];
let redTiles = [];
let greenTiles = [];
let blueTiles = [];
let activeTiles = [];

let redBoardSolved = false;
let greenBoardSolved = false;
let blueBoardSolved = false;
let activeBoardSolved = false;

let isPeeking = false;
let peekAlpha = 0;
let peekAnimProgress = 0;

let uiFrames = [
    {
        id: "red",
        collider: new RectangleCollisionShape2D(117, 157, 22, 22)
    }, 
    {
        id: "green",
        collider: new RectangleCollisionShape2D(149, 157, 22, 22)
    },
    {
        id: "blue",
        collider: new RectangleCollisionShape2D(181, 157, 22, 22)
    }
];

let playButtomCollider = new RectangleCollisionShape2D(141, 92, 37, 15);
let creditsButtomCollider = new RectangleCollisionShape2D(135, 108, 49, 15);
let backButtomCollider = new RectangleCollisionShape2D(55, 17, 31, 14);

let sfxVolume = 0.5;



function init() {
    createBoard("red");
    createBoard("green");
    createBoard("blue");

    shuffleBoard("red");
    shuffleBoard("green");
    shuffleBoard("blue");
}
function createBoard(color) {
    let board;
    let tiles;
    let texture;

    switch (color) {
        case "red": 
            board = redBoard;
            tiles = redTiles;
            texture = textures.redBoard;
            break;
        case "green": 
            board = greenBoard;
            tiles = greenTiles;
            texture = textures.greenBoard;
            break;
        case "blue": 
            board = blueBoard;
            tiles = blueTiles;
            texture = textures.blueBoard;
            break;
        default:
            break;
    }

    // Generate ordered board and each tile object;
    let index = 1;
    for (let row = 0; row < boardSize; row++) {
        board[row] = [];
        for (let col = 0; col < boardSize; col++) {
            board[row][col] = index;
            
            let x = col * tileSize + boardX;
            let y = row * tileSize + boardY;
            
            let tile = new Tile(index, texture, x, y, row, col, tileSize)

            tiles.push(tile)
            
            index += 1;
        }
    }
}
function shuffleBoard(color) {
    let board;
    let tiles;

    switch (color) {
        case "red": 
            board = redBoard;
            tiles = redTiles;
            redBoardSolved = false;
            break;
        case "green": 
            board = greenBoard;
            tiles = greenTiles;
            greenBoardSolved = false;
            break;
        case "blue": 
            board = blueBoard;
            tiles = blueTiles;
            blueBoardSolved = false;
            break;
        default:
            break;
    }

    // shuffle board by making random moves;
    let k = 500;
    while (k--) {
        tiles[randomInt(0, boardSize * boardSize - 2)].move(board);
    }
}

//
// Update;
//
function checkSolved(board) {
    let solvedBoard = fillArray(boardSize * boardSize)
    solvedBoard.shift();

    // Current Board;
    let b = board.flat();
    b.pop();


    switch (activeBoard) {
        case "red":
            redBoardSolved = solvedBoard.toString() === b.toString();
            break;
        case "green":
            greenBoardSolved = solvedBoard.toString() === b.toString();
            break;
        case "blue":
            blueBoardSolved = solvedBoard.toString() === b.toString();
            break;
        default:
            break;
    }
}
function handleInput(board, tiles) {
    if (isActionJustPressed("leftClick")) {
        for (const tile of tiles) {
            if (checkCollision(Game.mousePos, tile.collider) && !activeBoardSolved && tile.id !== 16) {
                tile.move(board);

                if (checkSolved(board)) { return; }
            };
        }

        for (const frame of uiFrames) {
            if (checkCollision(Game.mousePos, frame.collider)) {
                activeBoard = frame.id;

                sfxUiClick.play(sfxVolume);
            };
        }
    }

    if (isActionPressed("rightClick")) {
        isPeeking = true;
        animatePeek();
    } else {
        isPeeking = false;
        peekAlpha = 0;
        peekAnimProgress = 0;
    }

    if (isActionJustPressed("shuffle")) {
        shuffleBoard(activeBoard);
    }
}
function update() {
    activeBoardSolved = activeBoard === "red" && redBoardSolved
                    || activeBoard === "green" && greenBoardSolved
                    || activeBoard === "blue" && blueBoardSolved;

    switch (activeBoard) {
        case "red":
            activeTiles = redTiles;
            activeBoardTexture = textures.redBoard
            animateTiles(redTiles);
            handleInput(redBoard, redTiles);
            break;
        case "green":
            activeTiles = greenTiles;
            activeBoardTexture = textures.greenBoard
            animateTiles(greenTiles);
            handleInput(greenBoard, greenTiles);
            break;
        case "blue":
            activeTiles = blueTiles;
            activeBoardTexture = textures.blueBoard
            animateTiles(blueTiles);
            handleInput(blueBoard, blueTiles);
            break;
        default:
            break;
    }
}

//
// Animations;
//
function animateTiles(tiles) {
    for (const tile of tiles) {
        if (tile.animPlaying === true) {
            tile.animate();
        }
    }
}
function animatePeek() {
    peekAlpha = lerp(peekAlpha, 1, peekAnimProgress, "easeOutElastic");
    peekAnimProgress += 1/1000;
}

//
// Draw;
//
function drawStart() {
    let ctx = layers.main;
    let ctxUi = layers.ui;
    ctxUi.clearRect(0, 0, Game.width, Game.height);

    if (checkCollision(Game.mousePos, playButtomCollider)) {
        ctx.drawImage(textures.start2, 0, 0);

        if (isActionJustPressed("leftClick")) {
            Game.setGameState("run");

            sfxUiClick.play(sfxVolume);

            if (!gameStarted) {
                init();
                gameStarted = true;
            }
        }
    } else if (checkCollision(Game.mousePos, creditsButtomCollider)) {
        ctx.drawImage(textures.start3, 0, 0);

        if (isActionJustPressed("leftClick")) {
            Game.setGameState("credits");
            sfxUiClick.play(sfxVolume);
        }
    } else {
        ctx.drawImage(textures.start1, 0, 0);
    }
};
function drawCredits() {
    let ctx = layers.main;

    if (isActionReleased("back")) {
        Game.setGameState("start");
    }

    if (checkCollision(Game.mousePos, backButtomCollider)) {
        ctx.drawImage(textures.credits2, 0, 0);

        if (isActionJustPressed("leftClick")) {
            Game.setGameState("start");
            sfxUiClick.play(sfxVolume);
        }
    } else {
        ctx.drawImage(textures.credits1, 0, 0);
    }
}
function drawFrameUi() {
    let ctx = layers.ui;
    ctx.clearRect(0, 0, Game.width, Game.height)

    for (const frame of uiFrames) {
        if (checkCollision(Game.mousePos, frame.collider)) {
            ctx.drawImage(textures.frame, frame.collider.position.x, frame.collider.position.y)
        };
    }

    switch (activeBoard) {
        case "red":
            ctx.drawImage(textures.frame, uiFrames[0].collider.position.x, uiFrames[0].collider.position.y)
            break;
        case "green": 
            ctx.drawImage(textures.frame, uiFrames[1].collider.position.x, uiFrames[1].collider.position.y)
            break;
        case "blue":  
            ctx.drawImage(textures.frame, uiFrames[2].collider.position.x, uiFrames[2].collider.position.y)
            break;
        default:
            break;
    }

}
function draw() {
    let ctx = layers.main;
    let peekCtx = layers.peek;

    peekCtx.clearRect(0, 0, Game.width, Game.height);
    ctx.clearRect(0, 0, Game.width, Game.height);
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, Game.width, Game.height);

    //
    // Line under tiles
    //
    for (const tile of activeTiles) {
        ctx.fillStyle = "#313845";
        ctx.fillRect(tile.x, tile.y + tileSize, tileSize, 2);
    }

    //
    // Tile drawing and hover
    //
    for (const tile of activeTiles) {
        tile.draw(ctx);

        if (checkCollision(Game.mousePos, tile.collider) && !activeBoardSolved && tile.id !== 16) {
            ctx.drawImage(textures.tileFrame, tile.x, tile.y);
        }
    }

    //
    // Peeking
    //
    if (isPeeking) {
        peekCtx.globalAlpha = peekAlpha;
        peekCtx.drawImage(activeBoardTexture, boardX, boardY);
        peekCtx.globalAlpha = 1;
    }

    //
    // Draw Solved Boards
    //
    if (activeBoard === "red" && redBoardSolved) {
        ctx.drawImage(activeBoardTexture, boardX, boardY);
    }
    if (activeBoard === "green" && greenBoardSolved) {
        ctx.drawImage(activeBoardTexture, boardX, boardY);
    }
    if (activeBoard === "blue" && blueBoardSolved) {
        ctx.drawImage(activeBoardTexture, boardX, boardY);
    }
    
    //
    // Ui buttom press
    //
    if (isActionReleased("back")) {
        Game.setGameState("start");
    }
    if (checkCollision(Game.mousePos, backButtomCollider)) {
        ctx.drawImage(textures.bg2, 0, 0);
        
        if (isActionJustPressed("leftClick")) {
            Game.setGameState("start");
            sfxUiClick.play(sfxVolume);
        }
    } else {
        ctx.drawImage(textures.bg1, 0, 0);
    }
    
    drawFrameUi();
}


// Gameloop
function gameLoop(time) {
    updateInput();

    if (Game.state === "start") { drawStart(); }
    else if (Game.state === "credits") { drawCredits(); }
    else if (Game.state === "run") { 
        update();
        draw();
    }

    // Handle States
    if (isActionReleased("start") && Game.state === "start") {
        Game.setGameState("run");

        if (!gameStarted) {
            init();
            gameStarted = true;
        }
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();
