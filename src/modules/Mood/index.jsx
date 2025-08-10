// src/modules/Mood/index.jsx
import Form from "./Form";
import Graph from "./Graph";
import History from "./History";

export { Form, Graph, History };

// Fournit un export par défaut si tu fais `import Mood from ".../Mood"`
const Mood = { Form, Graph, History };
export default Mood;
