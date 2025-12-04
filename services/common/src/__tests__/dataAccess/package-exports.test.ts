/**
 * Tests for DataAccess package exports
 * 
 * Verifies that repositories can be imported from the common package
 * using the DataAccess namespace.
 */

import * as DataAccess from '../../dataAccess/index.js';
import { describe, expect, it } from 'vitest';

describe('DataAccess Package Exports', () => {
  it('should export getLeaseRepository from DataAccess namespace', () => {
    expect(DataAccess.getLeaseRepository).toBeDefined();
    expect(typeof DataAccess.getLeaseRepository).toBe('function');
  });

  it('should export getTemplateRepository from DataAccess namespace', () => {
    expect(DataAccess.getTemplateRepository).toBeDefined();
    expect(typeof DataAccess.getTemplateRepository).toBe('function');
  });

  it('should be able to get LeaseRepository instance via DataAccess', () => {
    const repository = DataAccess.getLeaseRepository();
    
    expect(repository).toBeDefined();
    expect(typeof repository.create).toBe('function');
    expect(typeof repository.findById).toBe('function');
    expect(typeof repository.findAll).toBe('function');
    expect(typeof repository.update).toBe('function');
    expect(typeof repository.deleteMany).toBe('function');
    expect(typeof repository.findLeaseIdsUsedByTenants).toBe('function');
    expect(typeof repository.findByIds).toBe('function');
  });

  it('should be able to get TemplateRepository instance via DataAccess', () => {
    const repository = DataAccess.getTemplateRepository();
    
    expect(repository).toBeDefined();
    expect(typeof repository.findByLinkedResources).toBe('function');
    expect(typeof repository.deleteMany).toBe('function');
    expect(typeof repository.updateMany).toBe('function');
  });

  it('should maintain singleton behavior when accessed via DataAccess', () => {
    const instance1 = DataAccess.getLeaseRepository();
    const instance2 = DataAccess.getLeaseRepository();
    
    expect(instance1).toBe(instance2);
  });
});
