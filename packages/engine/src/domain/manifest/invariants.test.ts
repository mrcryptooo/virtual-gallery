import { describe, expect, it } from 'vitest';
import { validateProjectInvariants } from './invariants.ts';
import { makePanorama, makeProject } from './manifest.fixture.ts';

describe('validateProjectInvariants (seeded defects)', () => {
  it('passes the valid baseline (incl. cross-floor and cross-building links)', () => {
    expect(validateProjectInvariants(makeProject())).toEqual([]);
  });

  it('rejects duplicate panorama ids across the whole project (flat namespace)', () => {
    const project = makeProject();
    project.buildings[1]!.floors[0]!.rooms[0]!.panoramas.push(makePanorama('pano-a'));
    expect(validateProjectInvariants(project).join('\n')).toMatch(/duplicate panorama id "pano-a"/);
  });

  it('rejects duplicate building ids', () => {
    const project = makeProject();
    project.buildings[1]!.id = 'building-one';
    expect(validateProjectInvariants(project).join('\n')).toMatch(/duplicate building id/);
  });

  it('rejects duplicate floor ids within one building', () => {
    const project = makeProject();
    project.buildings[0]!.floors[1]!.id = 'ground';
    expect(validateProjectInvariants(project).join('\n')).toMatch(/duplicate floor id/);
  });

  it('rejects duplicate room ids within one floor', () => {
    const project = makeProject();
    const floor = project.buildings[0]!.floors[0]!;
    floor.rooms.push({ ...floor.rooms[0]!, panoramas: floor.rooms[0]!.panoramas });
    // Same room id twice on the ground floor (panorama dupes are reported separately)
    expect(validateProjectInvariants(project).join('\n')).toMatch(/duplicate room id "lobby"/);
  });

  it('ignores info hotspots when checking link targets and connectivity', () => {
    const project = makeProject();
    project.buildings[0]!.floors[0]!.rooms[0]!.panoramas[0]!.hotspots.push({
      type: 'info',
      yaw: 5,
      pitch: 5,
      label: 'About',
      title: 'About',
      body: 'Info hotspots have no target.',
    });
    expect(validateProjectInvariants(project)).toEqual([]);
  });

  it('allows the same floor id in different buildings', () => {
    // Both buildings have a "ground" floor in the baseline — that is legal.
    expect(validateProjectInvariants(makeProject())).toEqual([]);
  });

  it('rejects a dangling hotspot target', () => {
    const project = makeProject();
    const pano = project.buildings[0]!.floors[0]!.rooms[0]!.panoramas[0]!;
    pano.hotspots.push({
      type: 'link',
      yaw: 0,
      pitch: 0,
      label: 'Go nowhere',
      target: 'does-not-exist',
      arrivalView: { yaw: 0, pitch: 0, fov: 90 },
    });
    expect(validateProjectInvariants(project).join('\n')).toMatch(
      /link target "does-not-exist" does not exist/,
    );
  });

  it('rejects a self-targeting hotspot', () => {
    const project = makeProject();
    const pano = project.buildings[0]!.floors[0]!.rooms[0]!.panoramas[0]!;
    pano.hotspots.push({
      type: 'link',
      yaw: 0,
      pitch: 0,
      label: 'Stay here',
      target: pano.id,
      arrivalView: { yaw: 0, pitch: 0, fov: 90 },
    });
    expect(validateProjectInvariants(project).join('\n')).toMatch(/targets itself/);
  });

  it('rejects a missing entrance panorama', () => {
    const project = makeProject();
    project.entrancePanorama = 'missing-entry';
    expect(validateProjectInvariants(project).join('\n')).toMatch(
      /entrancePanorama "missing-entry" does not exist/,
    );
  });

  it('rejects a missing cover panorama', () => {
    const project = makeProject();
    project.coverPanorama = 'missing-cover';
    expect(validateProjectInvariants(project).join('\n')).toMatch(/coverPanorama/);
  });

  it('rejects an orphan panorama unreachable from the entrance', () => {
    const project = makeProject();
    project.buildings[1]!.floors[0]!.rooms[0]!.panoramas.push(makePanorama('pano-orphan'));
    expect(validateProjectInvariants(project).join('\n')).toMatch(
      /"pano-orphan" is unreachable from the entrance/,
    );
  });

  it('reports every violation at once (contract §8)', () => {
    const project = makeProject();
    project.entrancePanorama = 'missing-entry';
    project.coverPanorama = 'missing-cover';
    project.buildings[1]!.id = 'building-one';
    const issues = validateProjectInvariants(project);
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });
});
