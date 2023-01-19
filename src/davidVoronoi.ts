import basicVert from './shaders/basic.vert.wgsl?raw'
import positionFrag from './shaders/position.frag.wgsl?raw'
import textureUrl from '/david.png?url'

// initialize webgpu device & config canvas context
async function initWebGPU(canvas: HTMLCanvasElement) {
    if(!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = navigator.gpu.getPreferredCanvasFormat ? navigator.gpu.getPreferredCanvasFormat() : context.getPreferredFormat(adapter)
    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * devicePixelRatio
    canvas.height = canvas.clientHeight * devicePixelRatio
    const size = {width: canvas.width, height: canvas.height}
    context.configure({
        device, format,
        // prevent chrome warning after v102
        alphaMode: 'opaque'
    })
    return {device, context, format, size}
}

// create pipiline & buffers
async function initPipeline(device: GPUDevice, format: GPUTextureFormat, numVorPoints: number) {

    var center = [0.4, 0.4]
    
    // create array of random floats
    const vorPoints = new Float32Array(numVorPoints * 2);
    for(var i = 0; i < vorPoints.length; i++){
        vorPoints[i] = Math.random()
         
    }
    for(var i = 0; i < vorPoints.length; i += 2){
        // scale the points toward a center quadratically
        vorPoints[i]   -= center[0]
        vorPoints[i+1] -= center[1]
        var mag = Math.sqrt(vorPoints[i] ** 2 + vorPoints[i+1] ** 2) ** 4
        vorPoints[i]   *= mag
        vorPoints[i+1] *= mag
        vorPoints[i]   += center[0]
        vorPoints[i+1] += center[1]
    }

    // two triangles that cover the entire screen space
    const vertListWithUVs = new Float32Array([
         1.0,  1.0, 0.0,    1.0, 0.0,
        -1.0,  1.0, 0.0,    0.0, 0.0,
         1.0, -1.0, 0.0,    1.0, 1.0,
        -1.0, -1.0, 0.0,    0.0, 1.0,
    ])

    // crate binding layout
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0, // voronoi point buffer
            visibility: GPUShaderStage.FRAGMENT,
            buffer: {},
        }, 
        {
            binding: 1, // sampler
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
        },
        {
            binding: 2, // texture
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
        }]
    })

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            bindGroupLayout, // @group(0)
        ]
    });
    
    const pipeline = await device.createRenderPipelineAsync({
        label: 'Basic Pipline',
        layout: pipelineLayout,
        vertex: {
            module: device.createShaderModule({
                code: basicVert,
            }),
            entryPoint: 'main',
            buffers: [{
                arrayStride: 5 * 4, // 3 position 2 uv (all float32 4 byte vals), isn't this same as array byte size?
                attributes: [
                    {
                        // position
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3',
                    },
                    {
                        // uv
                        shaderLocation: 1,
                        offset: 3 * 4,
                        format: 'float32x2',
                    }
                ]
            }]
        },
        fragment: {
            module: device.createShaderModule({
                code: positionFrag,
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        },
        primitive: {
            topology: 'triangle-strip',
        }
    } as GPURenderPipelineDescriptor)
    
    // create and write to vertex buffer
    const vertexBuffer = device.createBuffer({
        label: 'GPUBuffer store vertex',
        size: vertListWithUVs.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    }) 
    device.queue.writeBuffer(vertexBuffer, 0, vertListWithUVs)
    
    // create voronoi verts buffer
    const vorPointBuf = device.createBuffer({
        label: 'GPUBuffer store point list of voronoi points',
        size: vorPoints.byteLength, // array of f32 vals
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    // create a uniform group for Voronoi Points
    // const uniformGroup = device.createBindGroup({
    //     label: 'Uniform Group with Voronoi Points',
    //     layout: pipeline.getBindGroupLayout(0),
    //     entries: [
    //         {
    //             binding: 0,
    //             resource: { buffer: vorPointBuf }
    //         },
    //     ]
    // })

    // fetch an image and upload to GPUTexture
    const res = await fetch(textureUrl)
    const img = await res.blob()
    // const img = document.createElement('img')
    // img.src = textureUrl
    // await img.decode()
    const bitmap = await createImageBitmap(img)
    const textureSize = [bitmap.width, bitmap.height]
    // create empty texture
    const texture = device.createTexture({
        size: textureSize,
        format: 'rgba8unorm',
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    })
    // update image to GPUTexture
    device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: texture },
        textureSize
    )
    // Create a sampler with linear filtering for smooth interpolation.
    const sampler = device.createSampler({
        // addressModeU: 'repeat',
        // addressModeV: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear'
    })

    // create texture bind group
    const bindGroup = device.createBindGroup({
        label: 'Texture Group with Texture/Sampler',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer: vorPointBuf }
            },
            {
                binding: 1,
                resource: sampler
            },
            {
                binding: 2,
                resource: texture.createView()
            }
        ]
    })

    device.queue.writeBuffer(
        vorPointBuf,
        0,
        vorPoints
    )

    // return all vars
    return { pipeline, vertexBuffer, vorPointBuf, bindGroup }
}

// create & submit device commands
function draw(
    device: GPUDevice, 
    context: GPUCanvasContext,
    pipelineObj: {
        pipeline: GPURenderPipeline
        vertexBuffer: GPUBuffer
        vorPointBuf: GPUBuffer
        bindGroup: GPUBindGroup
    }
) {
    // start encoder
    const commandEncoder = device.createCommandEncoder()
    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }
        ],
    }
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    passEncoder.setPipeline(pipelineObj.pipeline)
    // set vertex
    passEncoder.setVertexBuffer(0, pipelineObj.vertexBuffer)
    // set the bindGroup
    passEncoder.setBindGroup(0, pipelineObj.bindGroup)
    // draw vertex count of the triangle list
    passEncoder.draw(4)
    passEncoder.end()
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()])
}

async function run(){
    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')

    const {device, context, format, size} = await initWebGPU(canvas)
    
    var numVorPoints = 100
    
    const pipelineObj = await initPipeline(device, format, numVorPoints)

    // then draw
    draw(device, context, pipelineObj) 
}
run()