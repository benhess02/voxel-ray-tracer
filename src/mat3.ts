export function create() : number[] {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

export function reset(matrix : number[]) : number[] {
    matrix[0] = 1;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 1;
    matrix[5] = 0;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 1;
    return matrix;
}

export function rotateX(matrix : number[], angle : number) : number[] {
    var sin_angle = Math.sin(angle);
    var cos_angle = Math.cos(angle);
    var m11 = matrix[0];
    var m21 = matrix[1];
    var m31 = matrix[2];
    var m12 = matrix[3];
    var m22 = matrix[4];
    var m32 = matrix[5];
    var m13 = matrix[6];
    var m23 = matrix[7];
    var m33 = matrix[8];
    matrix[0] = m11;
    matrix[1] = cos_angle * m21 - sin_angle * m31;
    matrix[2] = sin_angle * m21 + cos_angle * m31;
    matrix[3] = m12;
    matrix[4] = cos_angle * m22 - sin_angle * m32;
    matrix[5] = sin_angle * m22 + cos_angle * m32;
    matrix[6] = m13;
    matrix[7] = cos_angle * m23 - sin_angle * m33;
    matrix[8] = sin_angle * m23 + cos_angle * m33;
    return matrix;
}

export function rotateY(matrix : number[], angle : number) : number[] {
    var sin_angle = Math.sin(angle);
    var cos_angle = Math.cos(angle);
    var m11 = matrix[0];
    var m21 = matrix[1];
    var m31 = matrix[2];
    var m12 = matrix[3];
    var m22 = matrix[4];
    var m32 = matrix[5];
    var m13 = matrix[6];
    var m23 = matrix[7];
    var m33 = matrix[8];
    matrix[0] = cos_angle * m11 + sin_angle * m31;
    matrix[1] = m21;
    matrix[2] = -sin_angle * m11 + cos_angle * m31;
    matrix[3] = cos_angle * m12 + sin_angle * m32;
    matrix[4] = m22;
    matrix[5] = -sin_angle * m12 + cos_angle * m32;
    matrix[6] = cos_angle * m13 + sin_angle * m33;
    matrix[7] = m23;
    matrix[8] = -sin_angle * m13 + cos_angle * m33;
    return matrix;
}

export function rotateZ(matrix : number[], angle : number) : number[] {
    var sin_angle = Math.sin(angle);
    var cos_angle = Math.cos(angle);
    var m11 = matrix[0];
    var m21 = matrix[1];
    var m31 = matrix[2];
    var m12 = matrix[3];
    var m22 = matrix[4];
    var m32 = matrix[5];
    var m13 = matrix[6];
    var m23 = matrix[7];
    var m33 = matrix[8];
    matrix[0] = cos_angle * m11 - sin_angle * m21;
    matrix[1] = sin_angle * m11 + cos_angle * m21;
    matrix[2] = m31;
    matrix[3] = cos_angle * m12 - sin_angle * m22;
    matrix[4] = sin_angle * m12 + cos_angle * m22;
    matrix[5] = m32;
    matrix[6] = cos_angle * m13 - sin_angle * m23;
    matrix[7] = sin_angle * m13 + cos_angle * m23;
    matrix[8] = m33;
    return matrix;
}

export function multiplyVec(matrix : number[], vec : number[]) : number[] {
    var x = vec[0];
    var y = vec[1];
    var z = vec[2];
    vec[0] = x * matrix[0] + y * matrix[3] + z * matrix[6];
    vec[1] = x * matrix[1] + y * matrix[4] + z * matrix[7];
    vec[2] = x * matrix[2] + y * matrix[5] + z * matrix[8];
    return vec;
}