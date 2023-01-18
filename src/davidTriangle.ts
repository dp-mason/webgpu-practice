// the "?raw" syntax is a thing that "Vite" introduces. It allows us to import the raw text of the file as a string
import fillVert from './shaders/davidVor.vert.wgsl?raw'
import redFrag from './shaders/red.frag.wgsl?raw'
//import { vertexCount } from './util/sphere'

// initialize webgpu device & config canvas context
async function initWebGPU() {
    if(!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
        // powerPreference: 'low-power'
    })
    if (!adapter)
        throw new Error('No Adapter Found')
    
    const device = await adapter.requestDevice()

    const canvas = document.querySelector('canvas')

    if (!canvas)
        throw new Error('No Canvas Found')

    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = navigator.gpu.getPreferredCanvasFormat ? navigator.gpu.getPreferredCanvasFormat() : context.getPreferredFormat(adapter)
    const devicePixelRatio = window.devicePixelRatio || 1
    
    
    canvas.width = canvas.clientWidth * devicePixelRatio
    canvas.height = canvas.clientHeight * devicePixelRatio
    const size = {width: canvas.width, height: canvas.height}
    context.configure({
        // json specific format when key and value are the same
        device, format,
        // prevent chrome warning
        alphaMode: 'opaque'
    })
    return {device, context, format, size}
}

// takes an object representing out GPU and a color format as args
// returns an object representing a GPU Pipeline and (the vertex buffer we created)
async function initpipeline(device:GPUDevice, format:GPUTextureFormat, triVertList:Float32Array) {
    
    // create data here that can be fed into our shaders dynamically
    // declaring the data type here is important
    const vertices = triVertList
    // create a data structure that represents a GPU buffer descriptor befor passing it to create buffer
    // the parameters her designate that this is a buffer for verts that can be a destination for copying info into
    const vertBufDesc:GPUBufferDescriptor = {
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST 
    }
    // store the data we just created on the GPU by using a GPU buffer
    const vertexBuffer = device.createBuffer(vertBufDesc)
    device.queue.writeBuffer(vertexBuffer, 0, vertices)

    const vertShader = device.createShaderModule({
        code:fillVert
    })
    const fragShader = device.createShaderModule({
        code:redFrag
    })

    // create a GPURenderPipelineDescriptor that will be passed to createRenderPipeline()
    const pipeDescriptor:GPURenderPipelineDescriptor = {
        vertex: {
            module: vertShader,
            entryPoint: 'main',
            // buffers are the spaces that will be used to pass values into the shader function
            // in this example we have one buffer of linear memory that holds all three xyz coords in it contiguously
            buffers:[{
                arrayStride: 3 * 4,
                attributes: [{
                    shaderLocation: 0, // the 0th param in the shader func xyz coord
                    offset: 0,
                    format: 'float32x3'
                },
                // this is what it would look like if we wanted to add another param to the shader function
                /*{
                    shaderLocation: 1, // the next shader param, z coord
                    offset: 2 * 4,
                    format: 'float32'
                }*/]
            }]
        },
        fragment: {
            module: fragShader,
            entryPoint: 'main',
            targets: [{ format }] // output color format of the shader
        },
        primitive: {
            topology:'triangle-strip'
        },
        layout: 'auto' // TODO: what exactly is this option? it is somewhat new
    }

    const pipeline = await device.createRenderPipelineAsync(pipeDescriptor)
    // in the orillusion example, not exactly sure how this is useful yet
    const vertexObj = {
        vertices, vertexBuffer, 
        vertexCount: 3
    }
    return {pipeline, vertexObj}
}

// render pass
function draw(device: GPUDevice, pipeline: GPURenderPipeline, context:GPUCanvasContext, vertexObj:any /*I hate this param*/){
    // web GPU uses a schema called command encoder
    const encoder = device.createCommandEncoder()
    // add commands to the encoder for encoding
    const renderPass = encoder.beginRenderPass({
        colorAttachments:[{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear', // determines whether the old frame should be loaded back in or if it should be cleared before loading
            clearValue: {r:0, g:0, b:0, a:1}, // color to fill the screen with when clearing
            storeOp: 'store' // whether we should 'store' or 'discard' the result
        }]
    })
    // set the render pipeline to be used in this render pass
    renderPass.setPipeline(pipeline)

    renderPass.setVertexBuffer(0, vertexObj.vertexBuffer) // slot 0 means the first vertex buf slot of idk how many

    renderPass.draw(vertexObj.vertexCount) // TODO: how would I draw a pipeline that only has a frag shader? Is it possible?
    renderPass.end()
    const buffer = encoder.finish()
    // this next cmd not async but the GPU drawing process itself is separate async process
    device.queue.submit([buffer]) //submits the job we encoded into the buffer to the GPU
}

async function run(){
    // default state
    var vertList = new Float32Array([
        0.0, 1.0, 0.0,
        -0.5, -0.5, 0.0,
        0.5, -0.5, 0.0
    ])
    
    const {device, format, context} = await initWebGPU()
    const {pipeline, vertexObj} = await initpipeline(device, format, vertList)

    // start loop
    function frame(){
        // transform by time, and update vertList
        const now = Date.now() / 1000
        vertList[0] = Math.sin(now)
        vertList[1] = Math.cos(now)
        // TODO: write to vert buf again with new values
        device.queue.writeBuffer(vertexObj.vertexBuffer, 0, vertList)

        // then draw
        draw(device, pipeline, context, vertexObj)
        requestAnimationFrame(frame)
    }
    frame()
}
run()

// async function run(){
//     const {device, format, context} = await initWebGPU()
//     const {pipeline, vertexObj} = await initpipeline(device, format)
//     draw(device, pipeline, context, vertexObj)
// }

// run()