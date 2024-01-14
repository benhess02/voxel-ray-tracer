export function create(x : number, y : number, z : number) : number[] {
    return [x, y, z];
}

export function set(vector : number[], x : number, y : number, z : number) : number[] {
    vector[0] = x;
    vector[1] = y;
    vector[2] = z;
    return vector;
}

export function add(vector : number[], other : number[]) : number[] {
    vector[0] += other[0];
    vector[1] += other[1];
    vector[2] += other[2];
    return vector;
}

export function addImm(vector : number[], x : number, y : number, z : number) : number[] {
    vector[0] += x;
    vector[1] += y;
    vector[2] += z;
    return vector;
}

export function magSq(vector : number[]) : number {
    var x = vector[0];
    var y = vector[1];
    var z = vector[2];
    return x * x + y * y + z * z;
}

export function mag(vector : number[]) : number {
    var x = vector[0];
    var y = vector[1];
    var z = vector[2];
    return Math.sqrt(x * x + y * y + z * z);
}