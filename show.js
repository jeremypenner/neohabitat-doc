import { animate, celsFromMask, frameFromCels, framesFromAction, framesFromLimbAnimation, framesFromPropAnimation } from "./render.js"

const readBinary = async (url) => {
    const response = await fetch(url)
    if (!response.ok) {
        console.log(response)
        throw Error(`Failed to download ${url}`)
    }
    return new DataView(await response.arrayBuffer())
}

export const textNode = (text, type = "span") => {
    const node = document.createElement(type)
    node.innerText = text
    return node
}

export const wrapLink = (element, href) => {
    const link = document.createElement("a")
    link.href = href
    link.appendChild(element)
    return link
}

export const docBuilder = ({ detailHref, errorContainer }) => {
    const linkDetail = (element, filename, impl) => {
        return detailHref ? wrapLink(element, `${detailHref}?f=${filename}`) : element
    }

    const showError = (e, filename) => {
        if (errorContainer) {
            const errNode = document.createElement("p")
            console.error(e)
            errNode.appendChild(linkDetail(textNode(filename, "b"), filename))
            errNode.appendChild(textNode(e.toString(), "p"))
            if (e.stack) {
                errNode.appendChild(textNode(e.stack.toString(), "pre"))
            }
            errorContainer.appendChild(errNode)
        }
    }

    return { linkDetail, showError }
}

export const showAll = (doc, container, filename, values, f) => {
    for (const value of values) {
        try {
            let elements = f(value)
            if (elements && !Array.isArray(elements)) {
                elements = [elements]
            }
            if (elements) {
                for (const element of elements) {
                    container.appendChild(doc.linkDetail(element, filename))
                }
            }
        } catch (e) {
            doc.showError(e, filename)
        }
    }
}

export const propAnimationShower = (prop, colors = {}) =>
    (animation) => animate(framesFromPropAnimation(animation, prop, colors))

export const limbAnimationShower = (limb, colors = {}) =>
    (animation) => animate(framesFromLimbAnimation(animation, limb, colors))

export const actionShower = (body, limbColors = null) =>
    (action) => animate(framesFromAction(action, body, limbColors))

export const celmaskShower = (prop, colors = null) =>
    (celmask) => animate([frameFromCels(celsFromMask(prop, celmask), colors)])

export const celShower = (colors = null) =>
    (cel) => animate([frameFromCels([cel], colors)])

export const decodeBinary = async (filename, decode) => {
    try {
        const value = decode(await readBinary(filename))
        value.filename = filename
        return value
    } catch (e) {
        return { filename: filename, error: e }
    }
}
