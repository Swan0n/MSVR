
// Constructor
function StereoCamera(
    Convergence,
    EyeSeparation,
    AspectRatio,
    FOV,
    NearClippingDistance,
    FarClippingDistance
) {
    this.Convergence = Convergence;
    this.EyeSeparation = EyeSeparation;
    this.AspectRatio = AspectRatio;
    this.FOV = FOV * Math.PI / 180.0;
    this.NearClippingDistance = NearClippingDistance;
    this.FarClippingDistance = FarClippingDistance;

    this.ApplyLeftFrustum = function () {
        let top, bottom, left, right;
        top = this.NearClippingDistance * Math.tan(this.FOV / 2);
        bottom = -top;
        const a = this.AspectRatio * Math.tan(this.FOV / 2) * this.Convergence;
        const b = a - this.EyeSeparation / 2;
        const c = a + this.EyeSeparation / 2;
        left = -b * this.NearClippingDistance / this.Convergence;
        right = c * this.NearClippingDistance / this.Convergence;
        this.projection = m4.frustum(left, right, bottom, top, this.NearClippingDistance, this.FarClippingDistance);
        this.modelview = m4.translation(this.EyeSeparation / 2, 0.0, 0.0);
    }

    this.ApplyRightFrustum = function () {
        let top, bottom, left, right;
        top = this.NearClippingDistance * Math.tan(this.FOV / 2);
        bottom = -top;
        const a = this.AspectRatio * Math.tan(this.FOV / 2) * this.Convergence;
        const b = a - this.EyeSeparation / 2;
        const c = a + this.EyeSeparation / 2;
        left = -c * this.NearClippingDistance / this.Convergence;
        right = b * this.NearClippingDistance / this.Convergence;
        this.projection = m4.frustum(left, right, bottom, top, this.NearClippingDistance, this.FarClippingDistance);
        this.modelview = m4.translation(-this.EyeSeparation / 2, 0.0, 0.0);
    }
}
