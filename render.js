
// C64 RGB values taken from https://www.c64-wiki.com/wiki/Color
const c64Colors = [
    0x000000, 0xffffff, 0x880000, 0xaaffee, 0xcc44cc, 0x00cc55, 
    0x0000aa, 0xeeee77, 0xdd8855, 0x664400, 0xff7777, 0x333333,
    0x777777, 0xaaff66, 0x0088ff, 0xbbbbbb
]

// from paint.m:447
const celPatterns = [
    [0x00, 0x00, 0x00, 0x00],
    [0xaa, 0xaa, 0xaa, 0xaa],
    [0xff, 0xff, 0xff, 0xff],
    [0xe2, 0xe2, 0xe2, 0xe2],
    [0x8b, 0xbe, 0x0f, 0xcc],
    [0xee, 0x00, 0xee, 0x00],
    [0xf0, 0xf0, 0x0f, 0x0f],
    [0x22, 0x88, 0x22, 0x88],
    [0x32, 0x88, 0x23, 0x88],
    [0x00, 0x28, 0x3b, 0x0c],
    [0x33, 0xcc, 0x33, 0xcc],
    [0x08, 0x80, 0x0c, 0x80],
    [0x3f, 0x3f, 0xf3, 0xf3],
    [0xaa, 0x3f, 0xaa, 0xf3],
    [0xaa, 0x00, 0xaa, 0x00],
    [0x55, 0x55, 0x55, 0x55]
]

const makeCanvas = (w, h) => {
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    canvas.style.imageRendering = "pixelated"
    canvas.style.width = `${w * 3}px`
    canvas.style.height = `${h * 3}px`
    return canvas    
}

export const canvasForSpace = ({ minX, maxX, minY, maxY }) => makeCanvas((maxX - minX) * 8, maxY - minY)

const defaultColors = {
    wildcard: 6,
    skin: 10,
    pattern: 15
}

export const canvasFromBitmap = (bitmap, colors = {}) => {
    if (bitmap.length == 0 || bitmap[0].length == 0) {
        return null
    }
    const { wildcard, pattern, skin } = { ...defaultColors, ...colors }
    const patternColors = [6, wildcard, 0, skin]
    const h = bitmap.length
    const w = bitmap[0].length * 2
    const canvas = makeCanvas(w, h)
    const ctx = canvas.getContext("2d")
    const img = ctx.createImageData(w, h)

    const putpixel = (x, y, r, g, b, a) => {
        const i = (x * 8) + (y * w * 4)
        img.data[i]     = r
        img.data[i + 1] = g
        img.data[i + 2] = b
        img.data[i + 3] = a
        img.data[i + 4] = r
        img.data[i + 5] = g
        img.data[i + 6] = b
        img.data[i + 7] = a
    }

    for (let y = 0; y < bitmap.length; y ++) {
        const line = bitmap[y]
        // TODO: What is pattern 255?
        const patbyte = celPatterns[pattern < 0 || pattern > 15 ? 15 : pattern][y % 4]
        for (let x = 0; x < line.length; x ++) {
            const pixel = line[x]
            let color = null
            if (pixel == 0) { // transparent
                putpixel(x, y, 0, 0, 0, 0)
            } else if (pixel == 1) { // wild
                const shift = (x % 4) * 2
                color = patternColors[(patbyte & (0xc0 >> shift)) >> (6 - shift)]
            } else {
                color = patternColors[pixel]
            }
            if (color != null) {
                const rgb = c64Colors[color]
                putpixel(x, y, (rgb & 0xff0000) >> 16, (rgb & 0xff00) >> 8, rgb & 0xff, 0xff)
            }
        }
    }
    ctx.putImageData(img, 0, 0)
    return canvas
}

export const celsFromMask = (prop, celMask) => {
    const cels = []
    for (let icel = 0; icel < 8; icel ++) {
        const celbit = 0x80 >> icel
        if ((celMask & celbit) != 0) {
            cels.push(prop.cels[icel])
        }
    }
    return cels
}

// canvas coordinate spaces have the top-left corner at 0,0, x increasing to the right, y increasing down.
// habitat coordinate spaces have the object origin at 0,0, x increasing to the right, y increasing _up_.
// In addition, 1 unit horizontally in habitat coordinate space corresponds to 8 pixels horizontally in canvas space.
export const translateSpace = ({ minX, maxX, minY, maxY }, dx, dy) => {
    return { minX: minX + dx, maxX: maxX + dx, minY: minY + dy, maxY: maxY + dy }
}

export const compositeSpaces = (spaces) => {
    return { minX: Math.min(...spaces.map((f) => f ? f.minX : Math.min())),
             maxX: Math.max(...spaces.map((f) => f ? f.maxX : Math.max())),
             minY: Math.min(...spaces.map((f) => f ? f.minY : Math.min())),
             maxY: Math.max(...spaces.map((f) => f ? f.maxY : Math.max())) }
}

export const topLeftCanvasOffset = (outerSpace, innerSpace) => {
    return [(innerSpace.minX - outerSpace.minX) * 8, outerSpace.maxY - innerSpace.maxY]
}

export const drawInSpace = (ctx, canvas, ctxSpace, canvasSpace) => {
    const [x, y] = topLeftCanvasOffset(ctxSpace, canvasSpace)
    ctx.drawImage(canvas, x, y)
}

// Habitat's coordinate space consistently has y=0 for the bottom, and increasing y means going up
export const frameFromCels = (cels, celColors = null, paintOrder = null) => {
    if (cels.length == 0) {
        return null
    }
    let xRel = 0
    let yRel = 0
    let xOrigin = null
    let yOrigin = null
    let layers = []
    for (const [icel, cel] of cels.entries()) {
        if (cel) {
            if (xOrigin == null) {
                xOrigin = cel.xOffset
                yOrigin = cel.yOffset - cel.height
            }
            const x = cel.xOffset + xRel
            const y = cel.yOffset + yRel
            if (cel.bitmap) {
                const colors = (Array.isArray(celColors) ? celColors[icel] : celColors) ?? {}
                layers.push({ canvas: canvasFromBitmap(cel.bitmap, colors), minX: x, minY: y - cel.height, maxX: x + cel.width, maxY: y })
            } else {
                layers.push(null)
            }
            xRel += cel.xRel 
            yRel += cel.yRel
        } else {
            layers.push(null)
        }
    }

    if (paintOrder) {
        const reordered = []
        for (const ilayer of paintOrder) {
            reordered.push(layers[ilayer])
        }
        layers = reordered
    }

    const space = compositeSpaces(layers)

    const canvas = canvasForSpace(space)
    const ctx = canvas.getContext("2d")
    for (const layer of layers) {
        if (layer && layer.canvas) {
            drawInSpace(ctx, layer.canvas, space, layer)
        }
    }
    return {...translateSpace(space, -xOrigin, -yOrigin), canvas: canvas }
}

const framesFromAnimation = (animation, frameFromState) => {
    const frames = []
    for (let istate = animation.startState; istate <= animation.endState; istate ++) {
        const frame = frameFromState(istate)
        if (frame != null) {
            frames.push(frame)
        }
    }
    return frames
}

export const framesFromPropAnimation = (animation, prop, colors = null) => {
    const frameFromState = (istate) =>
        frameFromCels(celsFromMask(prop, prop.celmasks[istate]), colors)
    return framesFromAnimation(animation, frameFromState)
}

export const framesFromLimbAnimation = (animation, limb, colors = null) => {
    const frameFromState = (istate) => {
        const iframe = limb.frames[istate]
        if (iframe >= 0) {
            return frameFromCels([limb.cels[iframe]], colors)
        } else {
            return null
        }
    }
    return framesFromAnimation(animation, frameFromState)
}

const actionOrientations = {
    "stand_back": "back",
    "walk_front": "front",
    "walk_back": "back",
    "stand_front": "front",
    "sit_front": "front"
}

export const framesFromAction = (action, body, limbColors = null) => {
    const frames = []
    const chore = body.choreography[body.actions[action]]
    const animations = []
    const orientation = actionOrientations[action] ?? "side"
    const limbOrder = orientation == "front" ? body.frontFacingLimbOrder :
                      orientation == "back"  ? body.backFacingLimbOrder : 
                      null // side animations are always displayed in standard limb order
    for (const limb of body.limbs) {
        if (limb.animations.length > 0) {
            animations.push({ ...limb.animations[0] })
        } else {
            animations.push({ startState: 0, endState: 0 })
        }
    }
    for (const override of chore) {
        const ilimb = override.limb
        const newAnim = body.limbs[ilimb].animations[override.animation]
        animations[ilimb].startState = newAnim.startState
        animations[ilimb].endState = newAnim.endState
    }
    while (true) {
        const cels = []
        // const celColors = []
        let restartedCount = 0
        for (const [ilimb, limb] of body.limbs.entries()) {
            const animation = animations[ilimb]
            if (animation.current == undefined) {
                animation.current = animation.startState
            } else {
                animation.current ++
                if (animation.current > animation.endState) {
                    animation.current = animation.startState
                    restartedCount ++
                }
            }
            const istate = limb.frames[animation.current]
            if (istate >= 0) {
                cels.push(limb.cels[istate])
            } else {
                cels.push(null)
            }
            // limb.pattern is not a pattern index, it's a LIMB pattern index
            // celColors.push({ pattern: limb.pattern })
        }
        if (restartedCount == animations.length) {
            break
        }
        frames.push(frameFromCels(cels, null, limbOrder))
    }
    return frames
}

export const imageFromCanvas = (canvas) => {
    const img = document.createElement("img")
    img.src = canvas.toDataURL()
    img.width = canvas.width * 3
    img.height = canvas.height * 3
    img.style.imageRendering = "pixelated"
    return img
}

export const animate = (frames) => {
    const space = compositeSpaces(frames)

    if (frames.length == 0) {
        return { ...space, element: textNode("") }
    } else if (frames.length == 1) {
        return { ...space, element: imageFromCanvas(frames[0].canvas) }
    }
    const canvas = canvasForSpace(space)
    let iframe = 0
    const ctx = canvas.getContext("2d")
    const nextFrame = () => {
        const frame = frames[iframe]
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawInSpace(ctx, frame.canvas, space, frame)
        iframe = (iframe + 1) % frames.length
    }
    nextFrame()
    setInterval(nextFrame, 250)
    return { ...space, element: canvas }
}
