import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'exam_portal.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
      student_id_code TEXT,
      department TEXT NOT NULL DEFAULT 'Computer Science',
      semester TEXT NOT NULL DEFAULT 'Semester 4',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject_code TEXT NOT NULL,
      department TEXT NOT NULL,
      description TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      total_marks INTEGER NOT NULL,
      pass_percentage INTEGER NOT NULL DEFAULT 40,
      status TEXT NOT NULL CHECK(status IN ('available', 'upcoming', 'archived')),
      scheduled_date TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL CHECK(correct_option IN ('A', 'B', 'C', 'D')),
      marks INTEGER NOT NULL DEFAULT 4,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('in_progress', 'submitted')),
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      submitted_at TEXT,
      answers_json TEXT NOT NULL DEFAULT '{}',
      current_question_index INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL DEFAULT 0,
      correct_answers INTEGER NOT NULL DEFAULT 0,
      wrong_answers INTEGER NOT NULL DEFAULT 0,
      unanswered INTEGER NOT NULL DEFAULT 0,
      total_marks INTEGER NOT NULL DEFAULT 0,
      obtained_marks INTEGER NOT NULL DEFAULT 0,
      percentage REAL NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      auto_submitted INTEGER NOT NULL DEFAULT 0
    );
  `);

  seedSampleExams();
}

interface SeedQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  marks: number;
}

interface SeedExam {
  title: string;
  subject_code: string;
  department: string;
  description: string;
  duration_minutes: number;
  total_marks: number;
  pass_percentage: number;
  status: 'available' | 'upcoming' | 'archived';
  scheduled_date: string;
  questions: SeedQuestion[];
}

function seedSampleExams(): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM exams').get() as { count: number };
  if (row.count > 0) {
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const upcomingDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const sampleExams: SeedExam[] = [
    {
      title: 'Data Structures & Algorithms Mid-Term',
      subject_code: 'CS-301',
      department: 'Computer Science',
      description: 'Core assessment covering asymptotic complexity, trees, graphs, sorting algorithms, and dynamic programming.',
      duration_minutes: 20,
      total_marks: 40,
      pass_percentage: 40,
      status: 'available',
      scheduled_date: todayStr,
      questions: [
        {
          question_text: 'What is the worst-case time complexity of searching for an element in a balanced Binary Search Tree (AVL Tree) with n nodes?',
          option_a: 'O(1)',
          option_b: 'O(log n)',
          option_c: 'O(n)',
          option_d: 'O(n log n)',
          correct_option: 'B',
          marks: 4,
        },
        {
          question_text: 'Which data structure is used internally to implement Breadth-First Search (BFS) on a graph?',
          option_a: 'Stack',
          option_b: 'Priority Queue',
          option_c: 'Queue',
          option_d: 'Hash Table',
          correct_option: 'C',
          marks: 4,
        },
        {
          question_text: 'Which sorting algorithm guarantees O(n log n) time complexity in the worst case while requiring O(n) auxiliary space?',
          option_a: 'Quick Sort',
          option_b: 'Insertion Sort',
          option_c: 'Merge Sort',
          option_d: 'Selection Sort',
          correct_option: 'C',
          marks: 4,
        },
        {
          question_text: 'In a min-heap represented as a 0-indexed array, what is the index of the left child of the node at index i?',
          option_a: '2i + 1',
          option_b: '2i + 2',
          option_c: 'i / 2',
          option_d: '2i - 1',
          correct_option: 'A',
          marks: 4,
        },
        {
          question_text: 'Which traversal of a Binary Search Tree yields its node values in ascending sorted order?',
          option_a: 'Pre-order traversal',
          option_b: 'In-order traversal',
          option_c: 'Post-order traversal',
          option_d: 'Level-order traversal',
          correct_option: 'B',
          marks: 4,
        },
        {
          question_text: 'What is the amortized time complexity of pushing an element onto a dynamically resizing array (vector)?',
          option_a: 'O(1)',
          option_b: 'O(log n)',
          option_c: 'O(n)',
          option_d: 'O(n^2)',
          correct_option: 'A',
          marks: 4,
        },
        {
          question_text: 'Which algorithm finds the shortest path from a single source to all vertices in a weighted graph with non-negative edge weights?',
          option_a: 'Kruskal’s Algorithm',
          option_b: 'Prim’s Algorithm',
          option_c: 'Dijkstra’s Algorithm',
          option_d: 'Floyd-Warshall Algorithm',
          correct_option: 'C',
          marks: 4,
        },
        {
          question_text: 'What condition must hold for a recursive problem to benefit from Dynamic Programming?',
          option_a: 'Greedy choice property only',
          option_b: 'Overlapping subproblems and optimal substructure',
          option_c: 'Disjoint subproblems with linear recurrence',
          option_d: 'Constant branching factor',
          correct_option: 'B',
          marks: 4,
        },
        {
          question_text: 'Which hash collision resolution technique probes consecutive slots sequentially starting from the hashed index?',
          option_a: 'Separate chaining',
          option_b: 'Double hashing',
          option_c: 'Quadratic probing',
          option_d: 'Linear probing',
          correct_option: 'D',
          marks: 4,
        },
        {
          question_text: 'How many edges does a Minimum Spanning Tree of a connected undirected graph with V vertices contain?',
          option_a: 'V',
          option_b: 'V - 1',
          option_c: 'V + 1',
          option_d: '2V - 1',
          correct_option: 'B',
          marks: 4,
        },
      ],
    },
    {
      title: 'Database Management Systems',
      subject_code: 'CS-304',
      department: 'Computer Science',
      description: 'Comprehensive evaluation of relational algebra, normalization forms, SQL indexing, and ACID transaction guarantees.',
      duration_minutes: 15,
      total_marks: 30,
      pass_percentage: 40,
      status: 'available',
      scheduled_date: todayStr,
      questions: [
        {
          question_text: 'Which normal form eliminates transitive functional dependencies of non-prime attributes on candidate keys?',
          option_a: 'First Normal Form (1NF)',
          option_b: 'Second Normal Form (2NF)',
          option_c: 'Third Normal Form (3NF)',
          option_d: 'Fourth Normal Form (4NF)',
          correct_option: 'C',
          marks: 5,
        },
        {
          question_text: 'In ACID properties of database transactions, what does Isolation guarantee?',
          option_a: 'Committed changes survive system crashes',
          option_b: 'Concurrent transactions execute without interfering with each other’s intermediate state',
          option_c: 'All operations succeed or none are applied',
          option_d: 'Every query uses a primary index',
          correct_option: 'B',
          marks: 5,
        },
        {
          question_text: 'Which SQL clause is used to filter aggregated groups after a GROUP BY operation?',
          option_a: 'WHERE',
          option_b: 'HAVING',
          option_c: 'ORDER BY',
          option_d: 'DISTINCT',
          correct_option: 'B',
          marks: 5,
        },
        {
          question_text: 'Which index data structure is most commonly used by relational databases to support fast range queries?',
          option_a: 'B+ Tree',
          option_b: 'Stack',
          option_c: 'Adjacency Matrix',
          option_d: 'Trie',
          correct_option: 'A',
          marks: 5,
        },
        {
          question_text: 'What type of join returns all rows from the left table and matched rows from the right table, with NULLs when there is no match?',
          option_a: 'INNER JOIN',
          option_b: 'CROSS JOIN',
          option_c: 'LEFT OUTER JOIN',
          option_d: 'NATURAL JOIN',
          correct_option: 'C',
          marks: 5,
        },
        {
          question_text: 'Which anomaly occurs when a transaction reads uncommitted changes made by another concurrent transaction that later rolls back?',
          option_a: 'Phantom Read',
          option_b: 'Dirty Read',
          option_c: 'Lost Update',
          option_d: 'Deadlock',
          correct_option: 'B',
          marks: 5,
        },
      ],
    },
    {
      title: 'Modern Web Engineering & HTTP',
      subject_code: 'IT-402',
      department: 'Information Technology',
      description: 'Examines RESTful API design, browser rendering, HTTP status semantics, and client-server security boundaries.',
      duration_minutes: 15,
      total_marks: 25,
      pass_percentage: 40,
      status: 'available',
      scheduled_date: todayStr,
      questions: [
        {
          question_text: 'Which HTTP status code indicates that a request succeeded and resulted in the creation of a new resource?',
          option_a: '200 OK',
          option_b: '201 Created',
          option_c: '204 No Content',
          option_d: '304 Not Modified',
          correct_option: 'B',
          marks: 5,
        },
        {
          question_text: 'Which HTTP method is defined as both safe and idempotent according to RFC 9110?',
          option_a: 'POST',
          option_b: 'PATCH',
          option_c: 'GET',
          option_d: 'CONNECT',
          correct_option: 'C',
          marks: 5,
        },
        {
          question_text: 'What is the primary purpose of the HttpOnly flag on a session cookie?',
          option_a: 'Encrypts the cookie payload automatically',
          option_b: 'Prevents client-side JavaScript from reading the cookie via document.cookie',
          option_c: 'Forces the cookie to expire after 60 seconds',
          option_d: 'Allows cross-domain sharing without CORS',
          correct_option: 'B',
          marks: 5,
        },
        {
          question_text: 'In React, which hook is specifically designed for synchronizing a component with an external system or timer?',
          option_a: 'useMemo',
          option_b: 'useReducer',
          option_c: 'useEffect',
          option_d: 'useId',
          correct_option: 'C',
          marks: 5,
        },
        {
          question_text: 'Which CSS layout property aligns flex or grid children along the main horizontal row axis by default in flexbox?',
          option_a: 'align-items',
          option_b: 'justify-content',
          option_c: 'place-self',
          option_d: 'flex-wrap',
          correct_option: 'B',
          marks: 5,
        },
      ],
    },
    {
      title: 'Operating Systems & Concurrency',
      subject_code: 'CS-308',
      department: 'Computer Science',
      description: 'Scheduled semester assessment covering process scheduling, virtual memory paging, deadlocks, and synchronization primitives.',
      duration_minutes: 25,
      total_marks: 50,
      pass_percentage: 45,
      status: 'upcoming',
      scheduled_date: upcomingDate,
      questions: [
        {
          question_text: 'Which CPU scheduling algorithm can suffer from indefinite postponement (starvation) of long processes?',
          option_a: 'Round Robin',
          option_b: 'First-Come, First-Served (FCFS)',
          option_c: 'Shortest Job Next (SJN)',
          option_d: 'Multilevel Feedback Queue with aging',
          correct_option: 'C',
          marks: 10,
        },
        {
          question_text: 'Which of the following is NOT one of the four Coffman conditions required for a deadlock to occur?',
          option_a: 'Mutual Exclusion',
          option_b: 'Hold and Wait',
          option_c: 'Preemption',
          option_d: 'Circular Wait',
          correct_option: 'C',
          marks: 10,
        },
        {
          question_text: 'What hardware component translates virtual memory addresses to physical memory addresses using a cache of recent translations?',
          option_a: 'ALU',
          option_b: 'Translation Lookaside Buffer (TLB)',
          option_c: 'DMA Controller',
          option_d: 'Interrupt Vector Table',
          correct_option: 'B',
          marks: 10,
        },
        {
          question_text: 'What phenomenon occurs when a system spends more time swapping pages between RAM and disk than executing instructions?',
          option_a: 'Internal Fragmentation',
          option_b: 'Thrashing',
          option_c: 'Belady’s Anomaly',
          option_d: 'Spooling',
          correct_option: 'B',
          marks: 10,
        },
        {
          question_text: 'A binary semaphore initialized to 1 is functionally equivalent to which synchronization primitive?',
          option_a: 'Condition Variable',
          option_b: 'Barrier',
          option_c: 'Mutex Lock',
          option_d: 'Read-Write Lock',
          correct_option: 'C',
          marks: 10,
        },
      ],
    },
  ];

  const insertExam = db.prepare(`
    INSERT INTO exams (title, subject_code, department, description, duration_minutes, total_marks, pass_percentage, status, scheduled_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertQuestion = db.prepare(`
    INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const createdAt = now.toISOString();
  db.exec('BEGIN');
  try {
    for (const exam of sampleExams) {
      const result = insertExam.run(
        exam.title,
        exam.subject_code,
        exam.department,
        exam.description,
        exam.duration_minutes,
        exam.total_marks,
        exam.pass_percentage,
        exam.status,
        exam.scheduled_date,
        createdAt
      );
      const examId = Number(result.lastInsertRowid);
      exam.questions.forEach((q, idx) => {
        insertQuestion.run(
          examId,
          q.question_text,
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
          q.correct_option,
          q.marks,
          idx + 1
        );
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
