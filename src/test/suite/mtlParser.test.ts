import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { MtlParser } from '../../webview/parsers/mtlParser';

suite('MTL Parser Test Suite', () => {
  let parser: MtlParser;

  setup(() => {
    parser = new MtlParser();
  });

  test('Should parse basic MTL with single material', async () => {
    const mtlContent = `newmtl red
Kd 1.0 0.0 0.0
Ka 0.0 0.0 0.0
Ks 0.0 0.0 0.0
d 1.0
illum 1
`;

    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.materials.size, 1);
    assert.ok(result.materials.has('red'), 'Should contain red material');

    const redMaterial = result.materials.get('red')!;
    assert.strictEqual(redMaterial.name, 'red');
    assert.deepStrictEqual(redMaterial.diffuseColor, { r: 1.0, g: 0.0, b: 0.0 });
    assert.deepStrictEqual(redMaterial.ambientColor, { r: 0.0, g: 0.0, b: 0.0 });
    assert.deepStrictEqual(redMaterial.specularColor, { r: 0.0, g: 0.0, b: 0.0 });
    assert.strictEqual(redMaterial.opacity, 1.0);
    assert.strictEqual(redMaterial.illuminationModel, 1);
  });

  test('Should parse MTL with multiple materials', async () => {
    const mtlContent = `newmtl red
Kd 1.0 0.0 0.0
Ka 0.1 0.0 0.0
d 1.0

newmtl green
Kd 0.0 1.0 0.0
Ka 0.0 0.1 0.0
d 0.8

newmtl blue
Kd 0.0 0.0 1.0
Ka 0.0 0.0 0.1
d 0.5
`;

    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.materials.size, 3);

    const redMaterial = result.materials.get('red')!;
    assert.deepStrictEqual(redMaterial.diffuseColor, { r: 1.0, g: 0.0, b: 0.0 });
    assert.strictEqual(redMaterial.opacity, 1.0);

    const greenMaterial = result.materials.get('green')!;
    assert.deepStrictEqual(greenMaterial.diffuseColor, { r: 0.0, g: 1.0, b: 0.0 });
    assert.strictEqual(greenMaterial.opacity, 0.8);

    const blueMaterial = result.materials.get('blue')!;
    assert.deepStrictEqual(blueMaterial.diffuseColor, { r: 0.0, g: 0.0, b: 1.0 });
    assert.strictEqual(blueMaterial.opacity, 0.5);
  });

  test('Should handle Tr transparency format', async () => {
    const mtlContent = `newmtl transparent
Kd 0.5 0.5 0.5
Tr 0.3
`;

    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    const material = result.materials.get('transparent')!;
    // Tr = 1 - d, so Tr 0.3 = d 0.7
    assert.strictEqual(material.opacity, 0.7);
  });

  test('Should ignore texture maps and unknown commands', async () => {
    const mtlContent = `newmtl textured
Kd 0.8 0.8 0.8
map_Kd texture.jpg
map_Bump bump.jpg
Ns 32.0
Ni 1.5
unknown_command value
`;

    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.materials.size, 1);
    const material = result.materials.get('textured')!;
    assert.deepStrictEqual(material.diffuseColor, { r: 0.8, g: 0.8, b: 0.8 });
    // Texture maps should be ignored
  });

  test('Should handle comments and empty lines', async () => {
    const mtlContent = `# MTL file with comments

# Red material
newmtl red
# Diffuse color
Kd 1.0 0.0 0.0

# Green material
newmtl green
Kd 0.0 1.0 0.0
# End of file
`;

    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.materials.size, 2);
    assert.ok(result.materials.has('red'));
    assert.ok(result.materials.has('green'));
  });

  test('Should use default values for incomplete materials', async () => {
    const mtlContent = `newmtl minimal
Kd 0.2 0.4 0.6
`;

    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    const material = result.materials.get('minimal')!;
    assert.deepStrictEqual(material.diffuseColor, { r: 0.2, g: 0.4, b: 0.6 });
    // Should have default values for missing properties
    assert.strictEqual(material.ambientColor, undefined);
    assert.strictEqual(material.specularColor, undefined);
    assert.strictEqual(material.opacity, undefined);
    assert.strictEqual(material.illuminationModel, undefined);
  });

  test('Should parse real facemesh MTL file', async () => {
    const testFilePath = path.join(
      __dirname,
      '../../../testfiles/new_formats/facemesh_wireframe 1.mtl'
    );

    // Only run this test if the file exists
    if (fs.existsSync(testFilePath)) {
      const data = fs.readFileSync(testFilePath);
      const result = await parser.parse(data);

      // The facemesh MTL should have the red material
      assert.ok(result.materials.size > 0, 'Should have at least one material');
      assert.ok(result.materials.has('red'), 'Should contain red material');

      const redMaterial = result.materials.get('red')!;
      assert.deepStrictEqual(redMaterial.diffuseColor, { r: 1.0, g: 0.0, b: 0.0 });
      assert.deepStrictEqual(redMaterial.ambientColor, { r: 0.0, g: 0.0, b: 0.0 });
      assert.deepStrictEqual(redMaterial.specularColor, { r: 0.0, g: 0.0, b: 0.0 });
      assert.strictEqual(redMaterial.opacity, 1.0);
      assert.strictEqual(redMaterial.illuminationModel, 1);

      console.log(`Facemesh MTL parsed: ${result.materials.size} material(s)`);
    } else {
      console.log('Skipping real file test - facemesh_wireframe 1.mtl not found');
    }
  });

  test('Should handle materials with only name', async () => {
    const mtlContent = `newmtl empty_material
newmtl another_empty
`;

    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.materials.size, 2);

    const material1 = result.materials.get('empty_material')!;
    assert.strictEqual(material1.name, 'empty_material');
    // Should have default gray diffuse color
    assert.deepStrictEqual(material1.diffuseColor, { r: 0.8, g: 0.8, b: 0.8 });

    const material2 = result.materials.get('another_empty')!;
    assert.strictEqual(material2.name, 'another_empty');
    assert.deepStrictEqual(material2.diffuseColor, { r: 0.8, g: 0.8, b: 0.8 });
  });

  test('Should handle illumination models', async () => {
    const mtlContent = `newmtl basic
Kd 0.5 0.5 0.5
illum 0

newmtl phong
Kd 0.7 0.7 0.7
illum 2

newmtl advanced
Kd 0.9 0.9 0.9
illum 7
`;

    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.materials.size, 3);
    assert.strictEqual(result.materials.get('basic')!.illuminationModel, 0);
    assert.strictEqual(result.materials.get('phong')!.illuminationModel, 2);
    assert.strictEqual(result.materials.get('advanced')!.illuminationModel, 7);
  });

  test('Should handle empty file gracefully', async () => {
    const mtlContent = ``;
    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.materials.size, 0);
  });

  test('Should handle file with only comments', async () => {
    const mtlContent = `# This is a comment file
# No materials defined
# Just comments
`;
    const data = new TextEncoder().encode(mtlContent);
    const result = await parser.parse(data);

    assert.strictEqual(result.materials.size, 0);
  });
});
