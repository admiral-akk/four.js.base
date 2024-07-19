import { CCDIKHelper } from "three/addons/animation/CCDIKSolver.js";
import { CCDIKSolver } from "three/addons/animation/CCDIKSolver.js";
import * as THREE from "three";
import { Vector3 } from "three";

export class Leg {
  update(input, bodyPos) {
    const delta = this.targetBone.position
      .clone()
      .sub(bodyPos)
      .sub(this.targetBone.idealDistance);
    delta.y = 0;

    if (delta.length() > 15) {
      const ideal = bodyPos.clone().add(this.targetBone.idealDistance);
      this.targetBone.position.set(
        ideal.x,
        this.targetBone.position.y,
        ideal.z
      );
    }

    this.ikSolver.update();
  }
  constructor(parent, scene) {
    const bones = [];
    const segmentHeight = 8;
    const segmentCount = 3;
    const height = segmentHeight * segmentCount;
    const halfHeight = height * 0.5;

    const sizing = {
      segmentHeight,
      segmentCount,
      height,
      halfHeight,
    };

    const material = new THREE.MeshPhongMaterial({
      color: 0x156289,
      emissive: 0x072534,
    });

    const material2 = new THREE.MeshPhongMaterial({
      color: 0x156289,
      emissive: 0x072534,
    });

    const makeMesh = (length) => {
      const geo = new THREE.BoxGeometry(1, length, 1);
      geo.translate(0, length / 2, 0);
      return new THREE.Mesh(geo, material2);
    };
    // "root bone"
    const rootBone = new THREE.Bone();

    this.rootBone = rootBone;
    rootBone.name = "root";
    rootBone.position.y = -sizing.halfHeight;
    bones.push(rootBone);

    //
    // "bone0", "bone1", "bone2", "bone3"
    //

    // "bone0"
    let prevBone = new THREE.Bone();
    prevBone.position.x = 0;
    prevBone.position.y = 0;
    prevBone.lookAt(new Vector3(1, 0, 0));
    rootBone.add(prevBone);
    bones.push(prevBone);
    // "bone1", "bone2", "bone3"
    for (let i = 1; i <= sizing.segmentCount; i++) {
      const bone = new THREE.Bone();
      const axesHelper = new THREE.AxesHelper(5);
      const length = i == 1 ? 2 : i === 3 ? 14 : 7;
      const m = makeMesh(length);
      switch (i) {
        case 1:
          m.rotation.setFromVector3(new Vector3(0, 0, -Math.PI / 2));
          bone.position.x = 2;
          break;
        case 2:
          bone.position.y = segmentHeight;
          break;
        case 3:
        default:
          bone.position.y = 2 * segmentHeight;
          break;
      }
      bones.push(bone);
      bone.name = `bone${i}`;
      prevBone.add(m);
      prevBone.add(axesHelper);
      prevBone.add(bone);
      prevBone = bone;
    }

    // "target"
    const targetBone = new THREE.Bone();
    targetBone.name = "target";
    scene.add(targetBone);
    bones.push(targetBone);
    this.targetBone = targetBone;

    const geometry = new THREE.BoxGeometry();

    const position = geometry.attributes.position;

    const vertex = new THREE.Vector3();

    const skinIndices = [];
    const skinWeights = [];

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      skinIndices.push(0, 0, 0, 0);
      skinWeights.push(0, 0, 0, 0);
    }

    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(skinIndices, 4)
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(skinWeights, 4)
    );
    const mesh = new THREE.SkinnedMesh(geometry, material);
    const skeleton = new THREE.Skeleton(bones);

    mesh.add(bones[0]);

    mesh.bind(skeleton);
    parent.add(mesh);
    mesh.position.y = 12;
    this.mesh = mesh;

    //
    // ikSolver
    //
    const iks = [
      {
        target: 5,
        effector: 4,
        maxAngle: 0.04,
        links: [
          {
            index: 3,
            limitation: new THREE.Vector3(0, 0, -1),
            rotationMax: new THREE.Vector3(0, 0, -0.1),
            rotationMin: new THREE.Vector3(0, 0, -Math.PI + 0.1),
          },
          {
            index: 2,
            limitation: new THREE.Vector3(0, 0, -1),
            rotationMax: new THREE.Vector3(0, 0, -0.1),
            rotationMin: new THREE.Vector3(0, 0, -1.5),
          },
          {
            index: 1,
            limitation: new THREE.Vector3(0, -1, 0),
          },
        ],
      },
    ];
    this.ikSolver = new CCDIKSolver(mesh, iks);
    scene.add(new CCDIKHelper(mesh, iks));
  }
}
