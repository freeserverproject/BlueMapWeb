export const SKY_VERTEX_SHADER = `
varying vec3 vPosition;
void main() {
	vPosition = position;
	
	gl_Position = 
		projectionMatrix *
		modelViewMatrix *
		vec4(position, 1);
}
`;