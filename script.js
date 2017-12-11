
"use strict";

const app = (function(){

    var canvas, context

    var DrawCache = {}

    const safeChars = str => str.replace(/[^a-zA-Z0-9]/g,"")

    const normalizeVector = (v,l) => { // v = original vector, l = normalized length
        let dX = v[0], dY = v[1]
        let dD = Math.sqrt( dX*dX + dY*dY )
        return [dX/dD * l, dY/dD * l]
    }

    var Env = {}

    var Player = {
        resources: {
            water: 0,
            unrefinedOre: 0,
            processedOre: 0,
            commonMinerals: 0,
            preciousMinerals: 0,
            astatine222: 0,
            neptunium261: 0,
            promethium177: 0,
            trifluxIxynonite: 0,
            activatedIxynonite: 0
        },
        kills: {},
        selectedEntity: {},
        updateKills: type => {
            Player.kills[type] += 1
        },
        updateUI: () => {
            var type
            for (type in Player.resources) document.getElementById(`player-resources-${type}-value`).innerHTML = Player.resources[type].toFixed(3)
            for (type in Player.kills) if (Player.kills[type]) {
                var safeCharsType = safeChars(type)
                var e = document.getElementById("kills-item-"+safeCharsType)
                if (!e) {
                    e = document.createElement("div")
                    e.innerHTML = `<span style="width:20em">${type}</span> <span id="kills-item-${safeCharsType}">1</span>`
                    document.getElementById("kills").appendChild(e)
                }
                else e.innerHTML = Player.kills[type]
            }
            Env.lastPlayerUIUpdate = new Date().getTime()
        }
    }

    var Entities = []
    var EntityGroups
    const resetEntityGroups = () => EntityGroups = {
        playerWeapons: [],
    }

    var SubterraneanEntities = []

    var Effects = []
    var EffectBook = {}
    EffectBook.impact = function(props) {
        this.x = props.x;
        this.y = props.y;
        this.rMax = props.r
        this.r = props.r * 0.05
        this.lifespan = props.lifespan || 1000
        this.tCreated = new Date().getTime()
    }
    EffectBook.impact.prototype.stepAndDraw = function(dt,index) {
        context.strokeStyle = "#FFFFFF"
        context.lineWidth = 1
        context.beginPath()
        context.arc(this.x, this.y, this.r, 0, 2*Math.PI, false)
        context.stroke()
        this.r += this.rMax * 0.05 * dt
        if (this.r > this.rMax) this.r = 0.05 * this.rMax
        if (Env.tGameplay - this.tCreated > this.lifespan) this.DEAD = true
    }
    const spawnEffect = (type,props) => Effects[Effects.push(new EffectBook[type](props)) - 1]


    const Viewport = (function(){
        var scale = 1 // scale FACTOR e.g. `size_on_screen = size*scale`
        var pos = { x:0, y:0 }
        return {
            init() { pos.x=0; pos.y=context.canvas.height/3; scale=1; },
            zoom(factor) { scale *= factor },
            move(axis,amount) { pos[axis] += amount*5 },
            scale: ()=>scale,
            x: ()=>pos.x,
            y: ()=>pos.y,
            setAll(x,y,s) { pos.x=x; pos.y=y; scale=s },
            clientToWorld(cX,cY){
                return [
                    pos.x - (context.canvas.width/scale/2) + (cX/scale),
                    pos.y + (context.canvas.height/scale/2) - (cY/scale)
                ]
            },
            getSkyCutoutXYWH() {
                let worldUnitsViewHeight = context.canvas.height/scale
                var yMax = pos.y + worldUnitsViewHeight/2
                if (yMax > 0) {
                    let worldUnitsViewWidth = context.canvas.width/scale
                    let yMin = yMax - worldUnitsViewHeight
                    return {
                        X: pos.x - worldUnitsViewWidth/2,
                        Y: yMin >=0 ? yMin : 0,
                        W: worldUnitsViewWidth,
                        H: yMin >=0 ? worldUnitsViewHeight : yMax
                    }
                }
                return null
            },
            getGroundCutoutXYWH() {
                let worldUnitsViewHeight = context.canvas.height/scale
                var yMin = pos.y - worldUnitsViewHeight/2
                if (yMin < 0) {
                    let worldUnitsViewWidth = context.canvas.width/scale
                    return {
                        X: pos.x - worldUnitsViewWidth/2,
                        Y: yMin,
                        W: worldUnitsViewWidth,
                        H: pos.y + worldUnitsViewHeight/2 > 0 ? 0 - yMin : worldUnitsViewHeight
                    }
                }
                return null
            }
        }
    })()

    const Spatial = (function(){
        const EDGE = 20
        const hash = n => Math.floor(n/EDGE)
        const test = (iA,iB) => {
            let eA = Entities[iA]
            let eB = Entities[iB]
            let rA = eA.r || 1
            let rB = eB.r || 1
            let dx = eA.x - eB.x
            let dy = eA.y - eB.y
            return Math.sqrt(dx*dx+dy*dy) - rA - rB <= 0
        }
        var bin = {}
        return {
            add(x,y,entityIndex){
                x = hash(x)
                y = hash(y)
                if (bin[x]) {
                    if (bin[x][y]) bin[x][y].push(entityIndex)
                    else bin[x][y] = [entityIndex]
                }
                else {
                    bin[x] = {}
                    bin[x][y] = [entityIndex]
                }
            },
            getNeighbors(x,y){
                x = hash(x)
                y = hash(y)
                var neighborsIndex = []
                for (var xAdd=-1; xAdd<2; xAdd+=1) {
                    var _addX = x + xAdd
                    if (bin[_addX]) for (var yAdd=-1; yAdd<2; yAdd+=1) {
                        var _addY = y + yAdd
                        if (bin[_addX][_addY]) bin[_addX][_addY].forEach( nI => neighborsIndex.push(nI) )
                    }
                }
                return neighborsIndex
            },
            runHitTest(){
                var couplets = {}
                var neighborsIndex
                for (var x in bin) for (var y in bin[x]) {
                    neighborsIndex = []
                    for (var xAdd=-1; xAdd<2; xAdd+=1) {
                        var _addX = parseInt(x) + xAdd
                        if (bin[_addX]) for (var yAdd=-1; yAdd<2; yAdd+=1) {
                            var _addY = parseInt(y) + yAdd
                            if (bin[_addX][_addY]) bin[_addX][_addY].forEach( nI => neighborsIndex.push(nI) )
                        }
                    }
                    bin[x][y].forEach( index => {
                        neighborsIndex.forEach( nI => {
                            if (nI !== index) {
                                var lowIndex = Math.min(nI,index)
                                var highIndex = Math.max(nI,index)
                                if (couplets[lowIndex]) {
                                    if (couplets[lowIndex][highIndex] === undefined) couplets[lowIndex][highIndex] = test(lowIndex,highIndex)
                                }
                                else {
                                    couplets[lowIndex] = {}
                                    couplets[lowIndex][highIndex] = test(lowIndex,highIndex)
                                }
                            }
                        })
                    })
                }
                // return result
                return couplets
            },
            reset() {
                bin = {}
            }
        }
    })()

    // GAMEPLAY LOOP -----------------------------------------------------------

    const gameplayLoop = function() {

        var i

        // get time step
        var tNow = new Date().getTime()
        var dt = tNow - Env.tGameplay
        if (dt > 40) console.log(dt + "ms elapsed between frames!")
        Env.tGameplay = tNow

        // reset spatial bin
        Spatial.reset()

        // step world actions
        resetEntityGroups()
        var dtGame = dt/16
        Entities.forEach( (entity,index) => {
            entity._index = index
            entity.step(dtGame,index)
            Spatial.add(entity.x,entity.y,index)
        })
        var couplets = Spatial.runHitTest()
        if (Object.keys(couplets).length) {
            for (var aI in couplets) for (var bI in couplets[aI]) if (couplets[aI][bI]) {
                var A = Entities[aI]
                var B = Entities[bI]
                if (A.injure && B.damage) {
                    A.injure(B.damage())
                    if (A.DEAD && B.owner===1) Player.updateKills(A.type)
                }
                if (B.injure && A.damage) {
                    B.injure(A.damage())
                    if (B.DEAD && A.owner===1) Player.updateKills(B.type)
                }
            }
        }
        SubterraneanEntities.forEach( (entity,index) => {
            entity._index = index
            entity.step(dtGame,index)
         })

        // handle user input
        UserInput.handle()
        
        // remove dead entities
        for (i = Entities.length; i--;) if (Entities[i].DEAD || Entities[i].y < 0) {
            if (Entities[i].die) Entities[i].die()
            Entities.splice(i,1)
        }

        // collision test and handle actions
        // clear canvas
        context.setTransform(1,0,0,1,0,0)
        context.clearRect(0,0,context.canvas.width,context.canvas.height)

        // set transform and draw
        context.setTransform(
            1*Viewport.scale(),
            0,0,
            -1*Viewport.scale(),
            context.canvas.width/2 - Viewport.x()*Viewport.scale(),
            context.canvas.height/2 + Viewport.y()*Viewport.scale()
        )
        // draw sky
        var skyDims = Viewport.getSkyCutoutXYWH()
        if (skyDims) {
            context.fillStyle = DrawCache.gradient.sky
            context.fillRect(skyDims.X, skyDims.Y, skyDims.W, skyDims.H)
        }
        // draw entities
        Entities.forEach( entity => entity.draw() )
        // draw ground
        var groundDims = Viewport.getGroundCutoutXYWH()
        if (groundDims) {
            context.fillStyle = "#331911"
            context.fillRect(groundDims.X, groundDims.Y, groundDims.W, groundDims.H)
            SubterraneanEntities.forEach( entity => entity.draw() )
        }
        Effects.forEach( (effect,index) => effect.stepAndDraw(dtGame,index) )
        for (i = Effects.length; i--;) if (Effects[i].DEAD) Effects.splice(i,1)
        
        // handle world randomization and progress
        if (Math.random() > 0.95) Dungeon.spawn("massDriver",{})
        if (Math.random() > 0.91) Dungeon.spawn("weaponizedMeteorite",{})

        //debug :: time frame
        // if(Math.random() > 0.95) console.log(new Date().getTime() - tNow)

        // update player UI if delay has elapsed
        if (Env.tGameplay - Env.lastPlayerUIUpdate > 700) Player.updateUI()

        // loop
        if (Env.state === "gameplay") window.requestAnimationFrame(gameplayLoop)

    }

    const DiggingTeam = (function(){
        
        var B = {} // buildings

        B.bidirectionalConduit = function(props) {
            this.xArr = props.xArr
            this.yArr = props.yArr
            this.r = 3
        }
        B.bidirectionalConduit.prototype.type = "Bidirectional Conduit"
        B.bidirectionalConduit.prototype.step = function(){}
        B.bidirectionalConduit.prototype.draw = function(){
            context.lineWidth = this.r*2
            context.strokeStyle = "#777"
            context.beginPath();
            context.moveTo(this.xArr[0],this.yArr[0]);
            context.lineTo(this.xArr[1],this.yArr[1]);
            context.stroke();
        }

        B.hydrothermalExtrator = function(props) {
            this.x = props.x
            this.y = props.y
            this.r = 15
            this.prod = {
                water: 0.0002,
                commonMinerals: 0.000005,
                preciousMinerals: 0.000001
            }
        }
        B.hydrothermalExtrator.prototype.type = "Hydrothermal Extrator"
        B.hydrothermalExtrator.prototype.step = function() {
            for (var type in this.prod) Player.resources[type] += this.prod[type]
        }
        B.hydrothermalExtrator.prototype.draw = function() {
            context.fillStyle = "#710"
            context.beginPath()
            context.arc(this.x, this.y, this.r, 0, 2*Math.PI, false)
            context.fill()
        }


        return {
            create(buildingType,props) {
                var e = new B[buildingType](props)
                SubterraneanEntities.push(e)
                return e
            }
        }
    })()

    const Dungeon = (function(){

        var T = {} // types

        const _setLevel = function(level,callback) {
            var dir = level - this.level > 0 ? 1 : -1
            while (this.level !== level) callback(dir)
        }

        const BaseEntity = function(props) {
            this.level = 1
            this.owner = props.owner
            this.tCreated = new Date().getTime()
            this.x = props.x
            this.y = props.y
            this.r = props.r
            if (props.level && this.setLevel) this.setLevel(props.level)
        }
        
        T.subterraneanPassage = function(props) {
            props.r = 6
            BaseEntity.call(this,props)
            this.bidirectionalConduit = DiggingTeam.create("bidirectionalConduit",{xArr:[this.x,this.x],yArr:[this.y,this.y-this.r-40],})
        }
        T.subterraneanPassage.prototype.type = "Subterranean Passage"
        T.subterraneanPassage.prototype.step = function() {}
        T.subterraneanPassage.prototype.draw = function() {
            context.fillStyle = "#0FF"
            context.fillRect(this.x-this.r,this.y-this.r,this.r*2,this.r*2)
        }
        T.subterraneanPassage.prototype.injure = function(damage) {
            let area = Math.PI * this.r * this.r - damage
            this.r = Math.sqrt(area / Math.PI)
        }



        T.plasmaGun = function(props) {
            props.r = 7
            BaseEntity.call(this,props)
            this.cooldown = 150
            this.lastFired = 0
            // this.color = [63,255,0]
            this.colorCycleIndex = 0
            this.colorCycleWheel = [
                [63,255,0]
                // [255,0,0],
                // [255,128,0],
                // [255,255,0],
                // [128,255,0],
                // [0,255,128],
                // [0,255,255],
                // [0,128,255],
                // [0,0,255]
            ]
        }
        T.plasmaGun.prototype.type = "Plasma Gun"
        T.plasmaGun.prototype.setLevel = function(level) {
            _setLevel.call(this, level, dir => {
                this.level += dir
                // this.cooldown += dir * -0.01 * this.cooldown
            })
        }
        T.plasmaGun.prototype.step = function(dt,index) {
            if (this.owner===1) EntityGroups.playerWeapons.push(index) // grant easy access to controllable weapons
        }
        T.plasmaGun.prototype.draw = function(){
            context.fillStyle = "#FF00FF"
            context.fillRect(this.x-this.r, this.y-this.r, this.r*2, this.r*2)
        }
        T.plasmaGun.prototype.injure = function(damage) {
            let area = this.r*this.r*Math.PI - damage
            if (area <= 25) this.DEAD = true
            else this.r = Math.sqrt(area/Math.PI)
        }
        T.plasmaGun.prototype.fire = function(t,worldPosArr) {
            if (t - this.lastFired >= this.cooldown) {
                Dungeon.spawn("plasma",{
                    color: this.colorCycleWheel[this.colorCycleIndex++],
                    owner: this.owner,
                    vector: worldPosArr,
                    x: this.x,
                    y: this.y + this.r + 3,
                    level: this.level,
                    speed: 1 + 0.5 * this.level,
                    r: 1.2 * 0.12 * this.level,
                    trailLength: 5 * 0.12 * this.level,
                    lifespan: 2500 - 30 * this.level
                })
                if (this.colorCycleIndex === this.colorCycleWheel.length) this.colorCycleIndex = 0
                this.lastFired = t
            }
        }

        T.plasma = function(props) {
            BaseEntity.call(this,props)
            this.trailLength = props.trailLength || this.r
            this.color = props.color
            this.speed = props.speed
            this.lifespan = props.lifespan
            let dX = props.vector[0] - this.x
            let dY = props.vector[1] - this.y
            let normVec = normalizeVector([dX,dY], this.speed)
            this.dx = normVec[0]
            this.dy = normVec[1]
            let addVec = normalizeVector([dX,dY], this.trailLength)
            this.xLengthAdd = addVec[0]
            this.yLengthAdd = addVec[1]
        }
        T.plasma.prototype.type = "Plasma"
        T.plasma.prototype.draw = function() {
            context.strokeStyle = "rgb("+this.color.join(",")+")"
            context.lineWidth = this.r
            context.beginPath()
            context.moveTo(this.x,this.y)
            context.lineTo(this.x-this.xLengthAdd,this.y-this.yLengthAdd)
            context.stroke()
        }
        T.plasma.prototype.step = function(dt,index) {
            if (Env.tGameplay - this.tCreated > this.lifespan) this.DEAD = true
            this.x += this.dx
            this.y += this.dy
        }
        T.plasma.prototype.damage = function() {
            this.DEAD = true
            return 4 * this.r * this.speed
        }

        T.massDriver = function(props) {
            this.r = props.r || 6
            this.dx = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 0.1
            this.dy = -0.8
            this.x = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 300
            this.y = 1600
        }
        T.massDriver.prototype.type = "Mass Driver"
        T.massDriver.prototype.draw = function() {
            context.fillStyle = "#FFD700"
            context.beginPath()
            context.arc(this.x, this.y, this.r, 0, 2*Math.PI, false)
            context.fill()
        }
        T.massDriver.prototype.step = function(dt,index) {
            this.x += this.dx * dt
            this.y += this.dy * dt
        }
        T.massDriver.prototype.injure = function(damage) {
            let area = this.r*this.r*Math.PI - damage
            if (area < 25) this.DEAD = true
            else this.r = Math.sqrt(area/Math.PI)
        }
        T.massDriver.prototype.damage = function() {
            this.DEAD = true
            return this.r * this.r * 2.5
        }
        T.massDriver.prototype.die = function() {
            spawnEffect("impact", {x:this.x, y:this.y, r:this.r*2.5, lifespan: 500})
        }

        T.weaponizedMeteorite = function() {
            this.r = 3
            this.dx = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 0.1
            this.dy = -1.3
            this.x = (Math.random() > 0.5 ? -1 : 1) * Math.random() * 300
            this.y = 1600
        }
        T.weaponizedMeteorite.prototype.type = "Weaponized Meteorite"
        T.weaponizedMeteorite.prototype.step = function(dt,index) {
            this.x += this.dx * dt
            this.y += this.dy * dt
        }
        T.weaponizedMeteorite.prototype.draw = function() {
            context.fillStyle = "#C0C0C0"
            context.beginPath()
            context.arc(this.x, this.y, this.r, 0, 2*Math.PI, false)
            context.fill()
        }
        T.weaponizedMeteorite.prototype.injure = function() {
            this.DEAD = true
        }
        T.weaponizedMeteorite.prototype.damage = function() {
            this.DEAD = true
            return Math.random()*13
        }
        T.weaponizedMeteorite.prototype.die = function() {
            spawnEffect("impact", {x:this.x, y:this.y, r:1.5*this.r, lifespan:350})
        }

        for (var _type in T) Player.kills[T[_type].prototype.type] = 0

        return {
            spawn: function(type,props) {
                if (!T[type]) throw new Error("invalid type")
                var e = new T[type](props)
                Entities.push(e)
                return e
            }
        }
    })()

    const resizeContext = function() {
        context.canvas.width = canvas.offsetWidth
        context.canvas.height = canvas.offsetHeight
    }

    const UserInput = (function(){
        var worldClickPos
        const inputAction = {
            gameplay: {
                "="(){Viewport.zoom(1.01)},
                "-"(){Viewport.zoom(0.99)},
                "ArrowUp"(){Viewport.move("y",1)},
                "ArrowDown"(){Viewport.move("y",-1)},
                "ArrowLeft"(){Viewport.move("x",-1)},
                "ArrowRight"(){Viewport.move("x",1)},
                "0"(){Viewport.setAll(0,0,1)},
                "mouse"(){
                    switch(Env.mouseAction) {
                        case "fire":
                            EntityGroups.playerWeapons.forEach( wIndex => Entities[wIndex].fire(Env.tGameplay,worldClickPos) )
                            break
                        case "select":
                            if (Env.tGameplay - Env.lastUserClick < 100) return null
                            Player.selectedEntity = null
                            let x = worldClickPos[0]
                            let y = worldClickPos[1]
                            Spatial.getNeighbors(x,y).some( eI => {
                                var entity = Entities[eI]
                                var dx = entity.x - x
                                var dy = entity.y - y
                                if (Math.sqrt(dx*dx+dy*dy) < entity.r) Player.selectedEntity = entity
                                return !!Player.selectedEntity
                            })
                            if (!Player.selectedEntity) SubterraneanEntities.some( entity => {
                                if (entity.xArr) {
                                    var xArr = entity.xArr
                                    var yArr = entity.yArr
                                    var m = (yArr[1] - yArr[0]) / (xArr[1] - xArr[0])
                                    if (Math.abs(m)> 1e6) m = 1e6
                                    var c = yArr[0] - m * xArr[0]
                                    var XE = (y-c)/m
                                    if (XE > Math.max(xArr[0]+entity.r,xArr[1]+entity.r) || XE < Math.min(xArr[0]-entity.r,xArr[1]-entity.r)) return false
                                    var YE = x*m+c
                                    if (YE > Math.max(yArr[0]+entity.r,yArr[1]+entity.r) || YE < Math.min(yArr[0]-entity.r,yArr[1]-entity.r)) return false
                                    var DX = XE - x
                                    var DY = YE - y
                                    var hypotenuse = Math.sqrt(DX*DX+DY*DY)
                                    var dist = Math.abs(DX)*Math.abs(DY)/hypotenuse
                                    
                                    if (dist <= entity.r) Player.selectedEntity = entity
                                }
                                else {
                                    var dx = entity.x - x
                                    var dy = entity.y - y
                                    if (Math.sqrt(dx*dx+dy*dy) < entity.r) Player.selectedEntity = entity
                                }
                                return !!Player.selectedEntity
                            })
                            if (Player.selectedEntity) {
                                console.log(Player.selectedEntity)
                            }
                            Env.lastUserClick = new Date().getTime()
                            break
                        case "construct":
                            console.log("unhandled behavior...")
                            break
                        default: throw new Error("no mouse action set")
                    }
                }
            }
        }
        var KeyMap = {}
        return {
            init() {
                window.addEventListener("keydown", event => KeyMap[event.key] = true )
                window.addEventListener("keyup", event => KeyMap[event.key] = false )
                canvas.addEventListener("mousemove", event => worldClickPos = Viewport.clientToWorld(event.clientX,event.clientY) )
                canvas.addEventListener("mousedown", event => KeyMap.mouse = true )
                canvas.addEventListener("mouseup", event => KeyMap.mouse = false )
                Array.from(document.getElementsByClassName("player-action-item")).forEach( e => {
                    e.onclick = event => {
                        Env.mouseAction = event.target.innerHTML.toLowerCase()
                        Array.from(document.getElementsByClassName("player-action-item-selected")).forEach( se => se.classList.remove("player-action-item-selected") )
                        event.target.classList.add("player-action-item-selected")
                    }
                })
            },
            handle() {
                for (var key in KeyMap) if (KeyMap[key] && inputAction[Env.state][key]) inputAction[Env.state][key]()
            }
        }
    })()

    return function() {
        if (!Env._READY) {

            // ready canvas
            canvas = document.getElementById("canvas")
            context = canvas.getContext("2d")
            resizeContext()
            window.addEventListener("resize",resizeContext)

            // ready drawing cache
            DrawCache.gradient = {}
            DrawCache.gradient.sky = context.createLinearGradient(0, 0, 0, 2000)
            DrawCache.gradient.sky.addColorStop(0, "rgb(120,50,120)")//"rgb(140,90,160)")
            DrawCache.gradient.sky.addColorStop(0.5, "rgba(0,0,0,0)")
            DrawCache.gradient.sky.addColorStop(1, "rgba(0,0,0,0)")

            // initialize submodules
            UserInput.init()
            Viewport.init()
            
            // set ready flag to prevent re-initialization
            Env._READY = true
        }
        if (Env.state) console.log("Env.state!",Env.state)
        Env.mouseAction = "fire"
        Env.state = "gameplay"
        Env.tGameplay = new Date().getTime()
        Env.lastPlayerUIUpdate = 0

        // debug :: create a weapon?
        Dungeon.spawn("plasmaGun",{x:-300,y:0,owner:1}).setLevel(5)
        Dungeon.spawn("plasmaGun",{x:0,y:0,owner:1}).setLevel(10)
        Dungeon.spawn("plasmaGun",{x:300,y:0,owner:1}).setLevel(20)
        Dungeon.spawn("subterraneanPassage",{x:150,y:0,owner:1})
        DiggingTeam.create("hydrothermalExtrator",{x:140,y:-30})

        window.requestAnimationFrame(gameplayLoop)
    }

})()

window.onload = app
