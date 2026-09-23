"use client"

import { Dithering } from '@paper-design/shaders-react'
import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
    window.addEventListener('resize', callback)
    return () => window.removeEventListener('resize', callback)
}

function getSnapshot() {
    return `${window.innerWidth}x${window.innerHeight}`
}

function getServerSnapshot() {
    return '1280x720'
}

export function BackgroundShader() {
    const size = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
    const [widthStr, heightStr] = size.split('x')
    const width = Number(widthStr) || 1280
    const height = Number(heightStr) || 720

    return (
        <Dithering
            width={width}
            height={height}
            colorBack="#0A0A0A"
            colorFront="#262626"
            shape="dots"
            type="random"
            size={6}
            speed={1}
            className='absolute top-0 left-0 w-full h-full -z-10'
        />
    )
}
