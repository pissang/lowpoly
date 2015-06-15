define(function (require) {

    var Pass = require('qtek/compositor/Pass');
    var Shader = require('qtek/Shader');
    var Texture2D = require('qtek/Texture2D');
    var FrameBuffer = require('qtek/FrameBuffer');

    require('qtek/shader/buildin');

    var sobelShaderCode = require('text!../asset/shader/sobel.essl');
    var directionalNonMaximumSuppressionShaderCode = require('text!../asset/shader/directionalNonMaximumSuppression.essl');
    var weakPixelInclusionShaderCode = require('text!../asset/shader/weakPixelInclusion.essl');

    var Canny = function (renderer) {
        this.renderer = renderer;

        this._passes = [
            new Pass({
                fragment: Shader.source('buildin.compositor.lum')
            }),
            new Pass({
                fragment: Shader.source('buildin.compositor.gaussian_blur_h')
            }),
            new Pass({
                fragment: Shader.source('buildin.compositor.gaussian_blur_v')
            }),
            new Pass({
                fragment: sobelShaderCode
            }),
            new Pass({
                fragment: directionalNonMaximumSuppressionShaderCode
            }),
            new Pass({
                fragment: weakPixelInclusionShaderCode
            })
        ];

        this._frameBuffer = new FrameBuffer();

        this._rt0 = new Texture2D({
            width: 256,
            height: 256
        });
        this._rt1 = new Texture2D({
            width: 256,
            height: 256
        });

        this._passes[1].setUniform('blurSize', 0.1);
        this._passes[2].setUniform('blurSize', 0.1);
    };

    Canny.prototype.filter = function (texture) {
        var rt0 = this._rt0;
        var rt1 = this._rt1;

        var frameBuffer = this._frameBuffer;

        this._passes[0].setUniform('texture', texture);
        this._passes[0].attachOutput(rt1);
        this._passes[0].render(this.renderer, frameBuffer);

        for (var i = 1; i < this._passes.length; i++) {
            swap();

            var pass = this._passes[i];

            pass.setUniform('textureWidth', rt0.width);
            pass.setUniform('textureHeight', rt0.height);

            pass.setUniform('texture', rt0);
            pass.attachOutput(rt1);

            pass.render(this.renderer, frameBuffer);
        }

        function swap() {
            var tmp = rt0;
            rt0 = rt1;
            rt1 = tmp;
        }

        return rt1;
    };

    return Canny;
});