import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Props = { speaking: boolean; focused: boolean; busy: boolean }

function createPanelTexture(title: string, kind: 'ledger' | 'payment' | 'courier' | 'voice') {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 320
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(3,23,32,.96)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#38dfad'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, 508, 316)
  ctx.fillStyle = '#8cf4d5'
  ctx.font = '600 20px Arial'
  ctx.fillText(title.toUpperCase(), 24, 38)
  ctx.fillStyle = 'rgba(126,249,219,.45)'
  ctx.fillRect(24, 54, 464, 1)

  if (kind === 'ledger') {
    ctx.fillStyle = 'rgba(127,241,210,.14)'
    ctx.fillRect(24, 74, 464, 205)
    ctx.strokeStyle = 'rgba(160,255,226,.2)'
    for (let row = 0; row < 4; row++) { ctx.beginPath(); ctx.moveTo(24, 110 + row * 43); ctx.lineTo(488, 110 + row * 43); ctx.stroke() }
    ctx.fillStyle = '#52e6bd'
    const heights = [64, 105, 82, 142, 112, 176, 150, 202, 168, 224, 190, 236]
    heights.forEach((height, i) => ctx.fillRect(38 + i * 36, 278 - height * .78, 19, height * .78))
  }
  if (kind === 'payment') {
    const rows = [['bKash', '•••• 2841', 'Verified'], ['Nagad', '•••• 6108', 'Matched'], ['Rocket', '•••• 9032', 'Verified']]
    rows.forEach(([provider, ref, status], i) => {
      const y = 76 + i * 70
      ctx.fillStyle = 'rgba(226,255,245,.07)'; ctx.fillRect(22, y, 468, 56)
      ctx.fillStyle = ['#d94d8d', '#e8953c', '#a772ce'][i]; ctx.fillRect(34, y + 14, 95, 28)
      ctx.fillStyle = '#fff'; ctx.font = '600 17px Arial'; ctx.fillText(provider, 43, y + 34)
      ctx.fillStyle = '#c5e6db'; ctx.font = '16px monospace'; ctx.fillText(ref, 148, y + 34)
      ctx.fillStyle = '#68efbc'; ctx.font = '14px Arial'; ctx.fillText(status, 365, y + 34)
    })
  }
  if (kind === 'courier') {
    ctx.strokeStyle = 'rgba(104,239,199,.36)'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(54, 213); ctx.lineTo(180, 126); ctx.lineTo(306, 184); ctx.lineTo(438, 100); ctx.stroke()
    ;[[54,213],[180,126],[306,184],[438,100]].forEach(([x,y], i) => {
      ctx.fillStyle = i === 3 ? '#80f5d0' : '#1b7d74'; ctx.beginPath(); ctx.arc(x, y, i === 3 ? 11 : 8, 0, Math.PI * 2); ctx.fill()
    })
    ctx.fillStyle = '#c3e7dc'; ctx.font = '16px Arial'; ctx.fillText('Order tracking · Provider sync', 28, 278)
  }
  if (kind === 'voice') {
    for (let line = 0; line < 3; line++) {
      ctx.strokeStyle = ['#60e6ca', '#3db9ca', '#73a8f1'][line]
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let x = 0; x <= 450; x += 4) {
        const y = 165 + Math.sin(x * .045 + line * 1.25) * (25 + line * 9) * Math.sin(x * .009 + .5)
        x === 0 ? ctx.moveTo(30 + x, y) : ctx.lineTo(30 + x, y)
      }
      ctx.stroke()
    }
    ctx.fillStyle = '#b8ddd2'; ctx.font = '16px Arial'; ctx.fillText('Voice assistant · Ready', 28, 278)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  return texture
}

function makePanel(title: string, kind: 'ledger' | 'payment' | 'courier' | 'voice', x: number, y: number, z: number, rotY: number) {
  const group = new THREE.Group()
  const geometry = new THREE.PlaneGeometry(1.78, 1.11)
  const texture = createPanelTexture(title, kind)
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false })
  const panel = new THREE.Mesh(geometry, material)
  group.add(panel)
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x52edc3, transparent: true, opacity: .9 }))
  group.add(border)
  group.position.set(x, y, z)
  group.rotation.y = rotY
  group.userData.baseY = y
  return group
}

function addCapsule(parent: THREE.Object3D, radius: number, length: number, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 12), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function addJoint(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius = .16) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function buildHumanoid() {
  const root = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x102f3a, metalness: .78, roughness: .25 })
  const shell = new THREE.MeshStandardMaterial({ color: 0x9df5dd, metalness: .46, roughness: .23, emissive: 0x146e67, emissiveIntensity: .28 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x06151e, metalness: .63, roughness: .28 })
  const trim = new THREE.MeshStandardMaterial({ color: 0x41e2bc, metalness: .35, roughness: .2, emissive: 0x13a889, emissiveIntensity: .65 })
  const eye = new THREE.MeshStandardMaterial({ color: 0xbffff0, emissive: 0x58fbd2, emissiveIntensity: 3.2, roughness: .1 })

  const body = new THREE.Group()
  root.add(body)

  const torso = addCapsule(body, .48, .78, metal, 0, -.88, 0)
  torso.scale.set(1.08, 1, .78)
  const chest = new THREE.Mesh(new THREE.SphereGeometry(.51, 32, 24), shell)
  chest.scale.set(.96, .77, .35)
  chest.position.set(0, -.68, .26)
  body.add(chest)
  const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(.14, 1), trim)
  chestCore.position.set(0, -.63, .61)
  body.add(chestCore)
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(.3, .42, .25, 24), dark)
  waist.position.set(0, -1.47, 0)
  body.add(waist)
  const legs: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(side * .21, -1.62, 0)
    body.add(hip)
    addJoint(hip, trim, 0, 0, .02, .13)
    addCapsule(hip, .16, .42, metal, 0, -.31, 0)
    addJoint(hip, dark, 0, -.62, .02, .12)
    addCapsule(hip, .145, .4, shell, 0, -.91, .01)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.24, .14, .4), dark)
    foot.position.set(0, -1.19, .1)
    hip.add(foot)
    const toe = new THREE.Mesh(new THREE.BoxGeometry(.19, .045, .2), trim)
    toe.position.set(0, -1.22, .25)
    hip.add(toe)
    legs.push(hip)
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.14, .19, .28, 20), trim)
  neck.position.set(0, -.23, 0)
  body.add(neck)
  const head = new THREE.Group()
  head.position.set(0, .4, .02)
  body.add(head)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.48, 36, 28), shell)
  skull.scale.set(.82, 1.02, .76)
  head.add(skull)
  const face = new THREE.Mesh(new THREE.SphereGeometry(.36, 32, 24), dark)
  face.scale.set(.92, .74, .28)
  face.position.set(0, -.05, .286)
  head.add(face)
  const eyes = [-1, 1].map(side => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.052, 20, 16), eye)
    e.position.set(side * .115, .015, .393)
    head.add(e)
    return e
  })
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.12, .018, .018), trim)
  mouth.position.set(0, -.16, .39)
  head.add(mouth)
  const earGeometry = new THREE.TorusGeometry(.11, .025, 8, 28)
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeometry, trim)
    ear.position.set(side * .4, -.015, .02)
    ear.rotation.y = side * .18
    head.add(ear)
  }
  const antenna = new THREE.Group()
  antenna.position.set(0, .46, 0)
  head.add(antenna)
  const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(.018, .028, .18, 10), trim)
  antennaStem.position.y = .08
  antenna.add(antennaStem)
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), eye)
  antennaTip.position.y = .18
  antenna.add(antennaTip)

  const arms: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * .54, -.42, 0)
    body.add(shoulder)
    const shoulderShell = new THREE.Mesh(new THREE.SphereGeometry(.22, 24, 18), shell)
    shoulderShell.scale.set(1.15, 1, 1)
    shoulder.add(shoulderShell)
    addCapsule(shoulder, .145, .48, metal, 0, -.37, 0)
    addJoint(shoulder, trim, 0, -.68, .015, .14)
    const elbow = new THREE.Group()
    elbow.position.set(0, -.7, 0)
    shoulder.add(elbow)
    addCapsule(elbow, .12, .43, shell, 0, -.32, .015)
    addJoint(elbow, dark, 0, -.6, .02, .11)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.15, 20, 16), metal)
    hand.scale.set(.82, 1.1, .65)
    hand.position.set(0, -.72, .025)
    elbow.add(hand)
    // Thin, illuminated finger marks give the hands a readable humanoid silhouette.
    for (let f = -1; f <= 1; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(.024, .1, 3, 7), shell)
      finger.position.set(f * .06, -.85, .08)
      finger.rotation.z = f * .1
      elbow.add(finger)
    }
    arms.push(shoulder)
  }

  const backRing = new THREE.Mesh(new THREE.TorusGeometry(.56, .018, 8, 80), trim)
  backRing.position.set(0, -.65, -.19)
  backRing.rotation.x = .22
  body.add(backRing)
  return { root, body, head, eyes, mouth, chestCore, arms, legs, antennaTip, backRing }
}

export default function KashNodeMotionScene({ speaking, focused, busy }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ speaking, focused, busy })
  useEffect(() => { stateRef.current = { speaking, focused, busy } }, [speaking, focused, busy])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    } catch {
      mount.dataset.webgl = 'unavailable'
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 80)
    camera.position.set(0, -.16, 8.8)
    scene.add(new THREE.AmbientLight(0x9af9dc, 1.15))
    const keyLight = new THREE.DirectionalLight(0xe6fff7, 2.1)
    keyLight.position.set(2.6, 4, 6)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(0x2cf0c2, 24, 12)
    rimLight.position.set(-3.2, .5, -1.8)
    scene.add(rimLight)
    const fillLight = new THREE.PointLight(0x34a9ca, 11, 10)
    fillLight.position.set(3, -1, 2)
    scene.add(fillLight)

    const world = new THREE.Group()
    scene.add(world)
    const blackHole = new THREE.Group()
    blackHole.position.set(-2.45, .3, -2.2)
    const singularity = new THREE.Mesh(new THREE.SphereGeometry(.64, 40, 32), new THREE.MeshBasicMaterial({ color: 0x01040b, toneMapped: false }))
    blackHole.add(singularity)
    const lensGlow = new THREE.Mesh(new THREE.TorusGeometry(.74, .095, 12, 100), new THREE.MeshBasicMaterial({ color: 0xffe4a1, transparent: true, opacity: .88, toneMapped: false }))
    lensGlow.rotation.x = .28
    blackHole.add(lensGlow)
    const disk = new THREE.Mesh(new THREE.TorusGeometry(.9, .22, 16, 120), new THREE.MeshBasicMaterial({ color: 0xff9b45, transparent: true, opacity: .5, side: THREE.DoubleSide, toneMapped: false }))
    disk.rotation.x = .18
    disk.scale.set(1.8, .6, 1)
    blackHole.add(disk)
    const hotDisk = new THREE.Mesh(new THREE.TorusGeometry(.78, .055, 10, 120), new THREE.MeshBasicMaterial({ color: 0xffffe2, transparent: true, opacity: .9, toneMapped: false }))
    hotDisk.rotation.x = .16
    hotDisk.scale.set(1.8, .55, 1)
    blackHole.add(hotDisk)
    const outerLensingRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, .018, 8, 144), new THREE.MeshBasicMaterial({ color: 0xffd59b, transparent: true, opacity: .32, toneMapped: false }))
    outerLensingRing.rotation.x = .22
    outerLensingRing.scale.set(1.72, .57, 1)
    blackHole.add(outerLensingRing)
    world.add(blackHole)
    const character = buildHumanoid()
    world.add(character.root)
    character.root.scale.setScalar(1.12)
    character.root.position.y = .55

    const panelSpecs = [
      ['Transactions & ledger', 'ledger', -2.35, .55, -.45, .35],
      ['Payment check', 'payment', -2.33, -.93, -.12, .28],
      ['Courier telemetry', 'courier', 2.33, .55, -.45, -.35],
      ['Voice agent', 'voice', 2.33, -.93, -.12, -.28],
    ] as const
    const panels = panelSpecs.map(([title, kind, x, y, z, rotation]) => {
      const panel = makePanel(title, kind, x, y, z, rotation)
      world.add(panel)
      return panel
    })

    const platform = new THREE.Group()
    platform.position.y = -2.55
    world.add(platform)
    const rings = [1.05, 1.52, 2.02].map((radius, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .012, 8, 128), new THREE.MeshBasicMaterial({ color: 0x4cebc0, transparent: true, opacity: .6 - index * .13, toneMapped: false }))
      ring.rotation.x = Math.PI / 2
      platform.add(ring)
      return ring
    })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.38, 1.2, .85, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x31e6ba, transparent: true, opacity: .095, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }))
    beam.position.y = .22
    platform.add(beam)
    const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64), new THREE.MeshBasicMaterial({ color: 0x25bca2, transparent: true, opacity: .12, depthWrite: false, toneMapped: false }))
    floorGlow.rotation.x = -Math.PI / 2
    floorGlow.position.y = -.014
    platform.add(floorGlow)

    const particleCount = 1100
    const positions = new Float32Array(particleCount * 3)
    const starColors = new Float32Array(particleCount * 3)
    const starPalette = [0xfff8e8, 0xffe8bd, 0xffffff, 0xf3e7d0, 0xffd99a]
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - .5) * 18
      positions[i * 3 + 1] = Math.random() * 11 - 5.5
      positions[i * 3 + 2] = -3 + Math.random() * 5
      const color = new THREE.Color(starPalette[Math.floor(Math.random() * starPalette.length)])
      starColors[i * 3] = color.r
      starColors[i * 3 + 1] = color.g
      starColors[i * 3 + 2] = color.b
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ vertexColors: true, size: .026, transparent: true, opacity: .92, depthWrite: false, toneMapped: false, sizeAttenuation: true }))
    world.add(particles)

    let pointerX = 0
    let pointerY = 0
    let active = true
    const layout = () => {
      const width = Math.max(1, mount.clientWidth)
      const height = Math.max(1, mount.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      const compact = width < 620
      camera.position.z = compact ? 8.1 : 8.8
      character.root.scale.setScalar(compact ? 1.08 : 1.12)
      blackHole.scale.setScalar(compact ? .78 : 1)
      panels.forEach(panel => { panel.visible = !compact })
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(layout)
    observer.observe(mount)
    layout()

    const onPointerMove = (event: PointerEvent) => {
      const bounds = mount.getBoundingClientRect()
      pointerX = THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width - .5) * 2, -1, 1)
      pointerY = THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height - .5) * 2, -1, 1)
    }
    mount.addEventListener('pointermove', onPointerMove)

    const timer = new THREE.Timer()
    timer.connect(document)
    let frame = 0
    let speechAmount = 0
    let blinkTime = 2.5
    let blinkStart = -1
    const render = () => {
      timer.update()
      const t = timer.getElapsed()
      const appState = stateRef.current
      const targetSpeech = appState.speaking ? 1 : 0
      speechAmount += (targetSpeech - speechAmount) * .12
      const voicePulse = speechAmount * (.5 + .5 * Math.abs(Math.sin(t * 15)))
      character.mouth.scale.y = 1 + voicePulse * 2.4
      character.chestCore.scale.setScalar(1 + (appState.busy ? .32 : .08) * (.5 + .5 * Math.sin(t * 2.7)))
      character.antennaTip.scale.setScalar(1 + (appState.focused ? .32 : .08) * (.5 + .5 * Math.sin(t * 3.2)))
      character.backRing.rotation.z = t * .4
      character.root.position.y = .55 + Math.sin(t * 1.15) * .045

      if (!reduceMotion && t >= blinkTime) {
        blinkStart = t
        blinkTime = t + 2.8 + Math.random() * 3.5
      }
      const blink = blinkStart >= 0 && t - blinkStart < .14 ? Math.sin(((t - blinkStart) / .14) * Math.PI) : 0
      character.eyes.forEach(eyeMesh => { eyeMesh.scale.y = 1 - blink * .92 })
      const targetYaw = reduceMotion ? 0 : pointerX * .3 + Math.sin(t * .38) * .18
      const targetPitch = reduceMotion ? 0 : pointerY * .12 + (appState.focused ? .06 : 0) + (appState.busy ? -.07 : 0)
      character.head.rotation.y += (targetYaw - character.head.rotation.y) * .07
      character.head.rotation.x += (targetPitch - character.head.rotation.x) * .07
      character.arms[0].rotation.z = -.12 + Math.sin(t * .65) * .035
      character.arms[1].rotation.z = .12 - Math.sin(t * .65) * .035
      const stride = reduceMotion ? 0 : Math.sin(t * 2.2) * .28
      character.legs[0].rotation.x = stride
      character.legs[1].rotation.x = -stride
      character.arms[0].rotation.x = -stride * .48
      character.arms[1].rotation.x = stride * .48
      character.root.position.z = Math.sin(t * 4.4) * .035
      const visibleHalfWidth = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect
      const travelWidth = Math.max(.35, visibleHalfWidth - (camera.aspect < .8 ? .55 : 1.15))
      blackHole.position.x = Math.sin(t * .13) * travelWidth
      blackHole.position.y = .3 + Math.sin(t * .19) * Math.min(1.65, camera.position.z * .19)
      blackHole.rotation.z = reduceMotion ? 0 : t * .055
      character.body.rotation.y += ((reduceMotion ? 0 : Math.sin(t * .28) * .34 + pointerX * .1) - character.body.rotation.y) * .025
      character.body.rotation.x += ((appState.focused ? -.025 : .015) - character.body.rotation.x) * .035

      panels.forEach((panel, index) => {
        panel.position.y = panel.userData.baseY + (reduceMotion ? 0 : Math.sin(t * .78 + index * 1.45) * .065)
        panel.rotation.z = reduceMotion ? 0 : Math.sin(t * .42 + index) * .014
      })
      rings.forEach((ring, index) => { ring.rotation.z = reduceMotion ? 0 : t * (index % 2 ? -.2 : .16) })
      particles.rotation.y = reduceMotion ? 0 : t * .018
      rimLight.intensity = appState.busy ? 30 : 24
      renderer.render(scene, camera)
      if (!reduceMotion) frame = requestAnimationFrame(render)
    }
    render()

    return () => {
      active = false
      cancelAnimationFrame(frame)
      timer.dispose()
      observer.disconnect()
      mount.removeEventListener('pointermove', onPointerMove)
      scene.traverse(object => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose?.()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        ;(Array.isArray(material) ? material : material ? [material] : []).forEach(item => {
          const textured = item as THREE.MeshBasicMaterial
          textured.map?.dispose()
          item.dispose()
        })
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      if (active) mount.dataset.webgl = ''
    }
  }, [])

  return <div className="km-scene-canvas" ref={mountRef} aria-hidden="true" />
}
