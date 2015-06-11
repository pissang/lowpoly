define(function (require) {

    var Pass = require('qtek/compositor/Pass');
    var Shader = require('qtek/Shader');
    var Renderer = require('qtek/Renderer');
    var Animation = require('qtek/animation/Animation');
    var Texture2D = require('qtek/Texture2D');
    var delaunay = require('qtek/util/delaunay');
    var FrameBuffer = require('qtek/FrameBuffer');
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Shader = require('qtek/Shader');
    var Mesh = require('qtek/Mesh');
    var Scene = require('qtek/Scene');
    var OrthographicCamera = require('qtek/camera/Orthographic');
    var Material = require('qtek/Material');
    var Canny = require('./Canny');

    Shader.import(require('text!../asset/shader/triangle.essl'));

    var animation = new Animation();

    var renderer = new Renderer({
        canvas: document.getElementById('main')
    });
    renderer.resize(500, 500);

    var cannyEdge = new Canny(renderer);

    var video = document.createElement('video');
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia || navigator.msGetUserMedia;

    if (navigator.getUserMedia) {
        navigator.getUserMedia({
            video: true
        }, function (stream) {
            video.src = window.URL.createObjectURL(stream);
            video.onloadedmetadata = function(e) {
                video.play();
                animation.start();
            };
            video.width = 512;
            video.height = 256;
        }, function (err) {
            alert('Request camera failed');
        });
    }

    var videoCanvas = document.createElement('canvas');
    var videoCtx = videoCanvas.getContext('2d');
    videoCanvas.width = 512;
    videoCanvas.height = 512;
    document.body.appendChild(videoCanvas);
    var texture = new Texture2D({
        image: videoCanvas,
        dynamic: true
    });
    // texture.load('asset/texture/avatar.png');

    var outPass = new Pass({
        fragment: Shader.source('buildin.compositor.output')
    });

    var frameBuffer = new FrameBuffer();
    var tmpTexture = new Texture2D();

    var lowpolyMesh = new Mesh({
        material: new Material({
            shader: new Shader({
                vertex: Shader.source('triangle.vertex'),
                fragment: Shader.source('triangle.fragment')
            })
        }),
        culling: false,
        geometry: new DynamicGeometry()
    });
    var geometry = lowpolyMesh.geometry;
    var scene = new Scene();
    scene.add(lowpolyMesh);
    var camera = new OrthographicCamera();

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    function debugPoints(points) {
        var debugCanvas = document.getElementById('debug');
        var debugCtx = debugCanvas.getContext('2d');
        debugCanvas.width = renderer.getWidth();
        debugCanvas.height = renderer.getHeight();
        points.forEach(function (p) {
            debugCtx.fillRect((p[0] + 1) / 2 * debugCanvas.width, (1 - (p[1] + 1) / 2) * debugCanvas.height, 2, 2);
        });
    }

    animation.on('frame', function () {

        videoCtx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height);

        var res = cannyEdge.filter(texture);

        tmpTexture.width = res.width;
        tmpTexture.height = res.height;

        outPass.attachOutput(tmpTexture);

        outPass.setUniform('texture', res);
        outPass.render(renderer, frameBuffer);
        
        frameBuffer.bind(renderer);
        var gl = renderer.gl;
        var pixels = new Uint8Array(res.width * res.height * 4);
        gl.readPixels(0, 0, res.width, res.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        frameBuffer.unbind(renderer);

        var points = [];
        var count = 0;
        for (var x = 0; x < res.width; x++) {
            for (var y = 0; y < res.height; y++) {
                var i = y * res.width + x;
                if (pixels[i * 4] > 240) {
                    points.push([x / res.width * 2 - 1, y / res.height * 2 - 1])
                }
            }
        }
        // Add boundary points
        points.push([-1, -1], [1, 1], [1, -1], [-1, 1]);

        debugPoints(points);

        canvas.width = res.width;
        canvas.height = res.height;
        ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        var triangles = delaunay.triangulate(points);
        geometry.attributes.position.value.length = 0;
        geometry.attributes.color.value.length = 0;
        for (var i = 0; i < triangles.length; i++) {
            var centroid = [0, 0];
            for (var j = 0; j < 3; j++) {
                var vertex = triangles[i].vertices[j];
                centroid[0] += vertex[0];
                centroid[1] += vertex[1];
                vertex.push(0.5);
                geometry.attributes.position.value.push(vertex);
            }
            centroid[0] /= 3;
            centroid[1] /= 3;

            centroid[0] = (centroid[0] + 1) / 2;
            centroid[1] = 1 - (centroid[1] + 1) / 2;

            var x = Math.round(centroid[0] * canvas.width);
            var y = Math.round(centroid[1] * canvas.height);
            var off = Math.round(y * canvas.width + x) * 4;
            var r = imageData.data[off++] / 255;
            var g = imageData.data[off++] / 255;
            var b = imageData.data[off++] / 255;
            var a = imageData.data[off++] / 255;

            geometry.attributes.color.value.push(
                [r, g, b, a],
                [r, g, b, a],
                [r, g, b, a]
            );
        }

        geometry.dirty('position');
        geometry.dirty('color');

        renderer.render(scene, camera);
    });
});