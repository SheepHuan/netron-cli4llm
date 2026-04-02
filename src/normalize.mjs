const toShape = (type) => {
  const dims = type && type.shape && Array.isArray(type.shape.dimensions) ? type.shape.dimensions : null;
  if (!dims) {
    return null;
  }
  return dims.map((d) => (typeof d === 'bigint' ? d.toString() : d));
};

const toTensorType = (value) => {
  const type = value && value.type ? value.type : null;
  return {
    data_type: type && type.dataType ? type.dataType : null,
    shape: toShape(type),
    denotation: type && type.denotation ? type.denotation : null
  };
};

const stableValueKey = (value, fallback) => {
  if (value && typeof value.name === 'string' && value.name.length > 0) {
    return value.name;
  }
  return fallback;
};

const listModules = (model) => {
  if (Array.isArray(model.modules)) {
    return model.modules;
  }
  if (Array.isArray(model.graphs)) {
    return model.graphs;
  }
  return [];
};

const normalizeAttributeValue = (value, depth = 0, seen = new WeakSet()) => {
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (depth > 3) {
    return '[truncated]';
  }
  if (Array.isArray(value)) {
    const limited = value.slice(0, 32).map((item) => normalizeAttributeValue(item, depth + 1, seen));
    if (value.length > 32) {
      limited.push(`[... +${value.length - 32} more]`);
    }
    return limited;
  }
  if (ArrayBuffer.isView(value)) {
    return { type: value.constructor.name, length: value.length };
  }
  if (value instanceof Map) {
    const out = {};
    let index = 0;
    for (const [k, v] of value.entries()) {
      out[String(k)] = normalizeAttributeValue(v, depth + 1, seen);
      index += 1;
      if (index >= 32) {
        out.__truncated__ = true;
        break;
      }
    }
    return out;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }
    seen.add(value);
    const out = {};
    const keys = Object.keys(value).slice(0, 32);
    for (const key of keys) {
      out[key] = normalizeAttributeValue(value[key], depth + 1, seen);
    }
    if (Object.keys(value).length > 32) {
      out.__truncated__ = true;
    }
    return out;
  }
  return String(value);
};

const mapArgumentValues = (argument, fallbackPrefix) => {
  const values = Array.isArray(argument && argument.value) ? argument.value : [];
  return values.map((value, index) => {
    const key = stableValueKey(value, `${fallbackPrefix}#${index}`);
    return {
      name: key,
      type: toTensorType(value),
      has_initializer: Boolean(value && value.initializer)
    };
  });
};

export const toGraphJson = (model, sourcePath) => {
  const modules = listModules(model);

  const graphs = modules.map((graph, graphIndex) => {
    const graphId = graph.identifier || graph.name || `graph_${graphIndex}`;

    const nodes = (Array.isArray(graph.nodes) ? graph.nodes : []).map((node, nodeIndex) => {
      const nodeId = node.identifier || node.name || `${graphId}_node_${nodeIndex}`;
      const inputs = (Array.isArray(node.inputs) ? node.inputs : []).map((arg, argIndex) => ({
        name: arg.name || `input_${argIndex}`,
        values: mapArgumentValues(arg, `${nodeId}:in:${argIndex}`)
      }));
      const outputs = (Array.isArray(node.outputs) ? node.outputs : []).map((arg, argIndex) => ({
        name: arg.name || `output_${argIndex}`,
        values: mapArgumentValues(arg, `${nodeId}:out:${argIndex}`)
      }));
      const attributes = (Array.isArray(node.attributes) ? node.attributes : []).map((attr) => ({
        name: attr.name,
        type: attr.type || null,
        value: normalizeAttributeValue(attr.value),
        visible: attr.visible !== false
      }));

      return {
        id: nodeId,
        name: node.name || null,
        type: node.type && node.type.name ? node.type.name : null,
        category: node.type && node.type.category ? node.type.category : null,
        inputs,
        outputs,
        attributes
      };
    });

    const producers = new Map();
    for (const node of nodes) {
      for (const output of node.outputs) {
        for (const value of output.values) {
          if (!producers.has(value.name)) {
            producers.set(value.name, node.id);
          }
        }
      }
    }

    const edges = [];
    for (const node of nodes) {
      for (const input of node.inputs) {
        for (const value of input.values) {
          const from = producers.get(value.name);
          if (from) {
            edges.push({
              from,
              to: node.id,
              tensor: value.name
            });
          }
        }
      }
    }

    const graphInputs = (Array.isArray(graph.inputs) ? graph.inputs : []).map((arg, idx) => ({
      name: arg.name || `input_${idx}`,
      values: mapArgumentValues(arg, `${graphId}:graph_input:${idx}`)
    }));

    const graphOutputs = (Array.isArray(graph.outputs) ? graph.outputs : []).map((arg, idx) => ({
      name: arg.name || `output_${idx}`,
      values: mapArgumentValues(arg, `${graphId}:graph_output:${idx}`)
    }));

    return {
      id: graphId,
      name: graph.name || null,
      inputs: graphInputs,
      outputs: graphOutputs,
      nodes,
      edges
    };
  });

  return {
    schema_version: '1.0.0',
    model: {
      format: model.format || null,
      producer: model.producer || null,
      runtime: model.runtime || null,
      version: model.version || null,
      identifier: model.identifier || null,
      source_path: sourcePath
    },
    graphs
  };
};

export const toWeightsManifestJson = (model, sourcePath) => {
  const modules = listModules(model);
  const params = [];
  const seen = new Set();

  modules.forEach((graph, graphIndex) => {
    const graphId = graph.identifier || graph.name || `graph_${graphIndex}`;
    (Array.isArray(graph.nodes) ? graph.nodes : []).forEach((node, nodeIndex) => {
      const nodeId = node.identifier || node.name || `${graphId}_node_${nodeIndex}`;
      (Array.isArray(node.inputs) ? node.inputs : []).forEach((arg, argIndex) => {
        const values = Array.isArray(arg.value) ? arg.value : [];
        values.forEach((value, valueIndex) => {
          if (!value || !value.initializer) {
            return;
          }
          const name = stableValueKey(value, `${nodeId}:param:${argIndex}:${valueIndex}`);
          const key = `${graphId}::${nodeId}::${name}`;
          if (seen.has(key)) {
            return;
          }
          seen.add(key);
          params.push({
            name,
            graph_id: graphId,
            node_id: nodeId,
            input_name: arg.name || `input_${argIndex}`,
            tensor: toTensorType(value),
            location: {
              kind: 'embedded',
              note: 'Values are not expanded by default. Load on-demand if needed.'
            }
          });
        });
      });
    });
  });

  return {
    schema_version: '1.0.0',
    model: {
      format: model.format || null,
      identifier: model.identifier || null,
      source_path: sourcePath
    },
    params
  };
};
