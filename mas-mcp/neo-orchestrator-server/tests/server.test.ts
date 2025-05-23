import { expect } from 'chai';
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, beforeEach, vi } from 'vitest';
import { NeoOrchestratorServer } from '../src/index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, '../src/index.ts');

describe('Neo Orchestrator MCP Server', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let server: NeoOrchestratorServer;
  
  before(async () => {
    // Set up client and transport
    client = new Client(
      {
        name: 'test-client',
        version: '0.1.0',
      },
      {
        capabilities: {},
      }
    );
    
    // Convert process.env to Record<string, string> by filtering out undefined values
    const env: Record<string, string> = {};
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) {
        env[key] = value;
      }
    });
    
    transport = new StdioClientTransport({
      command: 'ts-node',
      args: ['--esm', SERVER_PATH],
      env,
      stderr: 'pipe',
    });
    
    await client.connect(transport);

    server = new NeoOrchestratorServer();
  });
  
  after(async () => {
    await client.close();
    await transport.close();
  });
  
  describe('Tool Handlers', () => {
    it('should list available tools', async () => {
      const result = await client.request({
        method: 'tools/list',
      });
      
      expect(result).to.have.property('tools');
      expect(result.tools).to.be.an('array');
      expect(result.tools.length).to.be.at.least(3);
      
      const toolNames = result.tools.map(tool => tool.name);
      expect(toolNames).to.include('belief_management');
      expect(toolNames).to.include('desire_formation');
      expect(toolNames).to.include('intention_selection');
    });
    
    it('should handle belief management commands', async () => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'belief_management',
          arguments: {
            belief: 'test_belief',
            action: 'add',
            value: 'test_value',
          },
        },
      });
      
      expect(result).to.have.property('content');
      expect(result.content).to.be.an('array');
      expect(result.content[0]).to.have.property('text');
      
      const response = JSON.parse(result.content[0].text);
      expect(response).to.have.property('success', true);
      expect(response).to.have.property('belief', 'test_belief');
      expect(response).to.have.property('action', 'add');
      expect(response).to.have.property('value', 'test_value');
    });
    
    it('should handle desire formation commands', async () => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'desire_formation',
          arguments: {
            goal: 'test_goal',
            priority: 5,
            context: 'test_context',
          },
        },
      });
      
      expect(result).to.have.property('content');
      expect(result.content).to.be.an('array');
      expect(result.content[0]).to.have.property('text');
      
      const response = JSON.parse(result.content[0].text);
      expect(response).to.have.property('success', true);
      expect(response).to.have.property('goal', 'test_goal');
      expect(response).to.have.property('priority', 5);
      expect(response).to.have.property('context', 'test_context');
    });
    
    it('should handle intention selection commands', async () => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'intention_selection',
          arguments: {
            desire: 'test_desire',
            options: ['option1', 'option2'],
            constraints: ['constraint1'],
          },
        },
      });
      
      expect(result).to.have.property('content');
      expect(result.content).to.be.an('array');
      expect(result.content[0]).to.have.property('text');
      
      const response = JSON.parse(result.content[0].text);
      expect(response).to.have.property('success', true);
      expect(response).to.have.property('desire', 'test_desire');
      expect(response).to.have.property('selectedIntention');
      expect(response).to.have.property('options').that.includes('option1');
      expect(response).to.have.property('constraints').that.includes('constraint1');
    });
    
    it('should reject invalid tool calls', async () => {
      try {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'nonexistent_tool',
            arguments: {},
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.have.property('code', -32601); // Method not found
      }
    });
    
    it('should validate tool parameters', async () => {
      try {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'belief_management',
            arguments: {
              // Missing required parameters
            },
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.have.property('code', -32602); // Invalid params
      }
    });
  });
  
  describe('Resource Handlers', () => {
    it('should list available resources', async () => {
      const result = await client.request({
        method: 'resources/list',
      });
      
      expect(result).to.have.property('resources');
      expect(result.resources).to.be.an('array');
      expect(result.resources.length).to.be.at.least(2);
      
      const resourceUris = result.resources.map(resource => resource.uri);
      expect(resourceUris).to.include('neo://workflows/sdlc');
      expect(resourceUris).to.include('neo://workflows/agent');
    });
    
    it('should list available resource templates', async () => {
      const result = await client.request({
        method: 'resources/templates/list',
      });
      
      expect(result).to.have.property('resourceTemplates');
      expect(result.resourceTemplates).to.be.an('array');
      expect(result.resourceTemplates.length).to.be.at.least(2);
      
      const templateUris = result.resourceTemplates.map(template => template.uriTemplate);
      expect(templateUris).to.include('neo://workflows/sdlc/{phase}');
      expect(templateUris).to.include('neo://workflows/agent/{agent}');
    });
    
    it('should read static resources', async () => {
      const result = await client.request({
        method: 'resources/read',
        params: {
          uri: 'neo://workflows/sdlc',
        },
      });
      
      expect(result).to.have.property('contents');
      expect(result.contents).to.be.an('array');
      expect(result.contents[0]).to.have.property('text');
      
      const content = JSON.parse(result.contents[0].text);
      expect(content).to.have.property('phases');
      expect(content).to.have.property('currentPhase');
      expect(content).to.have.property('status');
    });
    
    it('should read templated resources', async () => {
      const result = await client.request({
        method: 'resources/read',
        params: {
          uri: 'neo://workflows/sdlc/implementation',
        },
      });
      
      expect(result).to.have.property('contents');
      expect(result.contents).to.be.an('array');
      expect(result.contents[0]).to.have.property('text');
      
      const content = JSON.parse(result.contents[0].text);
      expect(content).to.have.property('phase', 'implementation');
      expect(content).to.have.property('artifacts');
      expect(content).to.have.property('status');
    });
    
    it('should reject invalid resource URIs', async () => {
      try {
        await client.request({
          method: 'resources/read',
          params: {
            uri: 'invalid://uri',
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.have.property('code', -32602); // Invalid request
      }
    });
  });

  describe('Belief Management', () => {
    it('should add a belief successfully', async () => {
      const result = await server['handleBeliefManagement']({
        belief: 'test-belief',
        action: 'add',
        value: 'test-value'
      });

      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.belief.belief).toBe('test-belief');
      expect(response.belief.value).toBe('test-value');
    });

    it('should remove a belief successfully', async () => {
      // First add a belief
      await server['handleBeliefManagement']({
        belief: 'test-belief',
        action: 'add',
        value: 'test-value'
      });

      // Then remove it
      const result = await server['handleBeliefManagement']({
        belief: 'test-belief',
        action: 'remove'
      });

      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.belief).toBeUndefined();
    });

    it('should throw error for invalid parameters', async () => {
      await expect(server['handleBeliefManagement']({
        belief: '',
        action: 'invalid' as any
      })).rejects.toThrow(McpError);
    });
  });

  describe('Desire Formation', () => {
    it('should form a desire successfully', async () => {
      const result = await server['handleDesireFormation']({
        goal: 'test-goal',
        priority: 5,
        context: 'test-context'
      });

      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.desire.goal).toBe('test-goal');
      expect(response.desire.priority).toBe(5);
      expect(response.desire.context).toBe('test-context');
    });

    it('should throw error for invalid priority', async () => {
      await expect(server['handleDesireFormation']({
        goal: 'test-goal',
        priority: 11, // Invalid: should be 1-10
        context: 'test-context'
      })).rejects.toThrow(McpError);
    });
  });

  describe('Intention Selection', () => {
    it('should select intention successfully', async () => {
      const result = await server['handleIntentionSelection']({
        desire: 'test-desire',
        options: ['option1', 'option2'],
        constraints: ['opt']
      });

      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.intention.desire).toBe('test-desire');
      expect(response.intention.selectedOption).toBe('option1');
    });

    it('should select best option based on constraints', async () => {
      const result = await server['handleIntentionSelection']({
        desire: 'test-desire',
        options: ['bad-option', 'good-match-option'],
        constraints: ['good', 'match']
      });

      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(result.content[0].text);
      expect(response.intention.selectedOption).toBe('good-match-option');
    });

    it('should throw error for empty options', async () => {
      await expect(server['handleIntentionSelection']({
        desire: 'test-desire',
        options: [],
        constraints: ['test']
      })).rejects.toThrow(McpError);
    });
  });
});