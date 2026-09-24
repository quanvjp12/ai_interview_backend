require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/interview/start', async function(req, res) {
    const { position, level, questions, language } = req.body;
    console.log('Interview data:');
    console.log({
        position,
        level,
        questions,
        language
    });
    try {
        const response = await client.responses.create({
            model: 'gpt-5.6-luna',
            input: `
                You are an AI technical interviewer.
                Create the first interview question for a ${level} level ${position} developer.
                Interview language: ${language}.
                The interview will contain ${questions} questions.
                Rules:
                - Ask only one question.
                - Do not provide the answer.
                - Do not provide explanations.
                - Make the question appropriate for the candidate's level.
                - Return only the interview question.
            `
        });
        const question = response.output_text;
        console.log('AI question:', question);
        res.json({
            question: question
        });
    } catch (error) {
        console.error('AI error:', error);
        res.status(500).json({
            message: 'Failed to generate interview question'
        });
    }
});

app.post('/api/interview/answer', async function(req, res) {
    const {
        position,
        level,
        questions,
        language,
        question,
        answer,
        history,
        currentQuestion
    } = req.body;
    console.log('Answer received:');
    console.log({
        position,
        level,
        questions,
        language,
        question,
        answer,
        currentQuestion
    });
    try {
        if (Number(currentQuestion) >= Number(questions)) {
            const response = await client.responses.create({
                model: 'gpt-5.6-luna',
                input: `
                    You are an AI technical interviewer.
                    Position: ${position}
                    Candidate level: ${level}
                    Interview language: ${language}
                    The interview is now complete.
                    Here is the complete interview history: ${JSON.stringify(history)}
                    Evaluate the candidate's overall interview performance.

                    Requirements:
                    - Score the candidate from 0 to 100.
                    - Give a concise overall evaluation.
                    - Identify 2 to 4 strengths.
                    - Identify 2 to 4 areas to improve.
                    - Give 2 to 4 practical recommendations.
                    - Evaluate the entire interview, not only the final answer.
                    - Use the requested interview language.
                    - Be appropriate for the candidate's level.
                `,
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'interview_result',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                score: { type: 'number' },
                                overall: { type: 'string' },
                                strengths: { type: 'array', items: { type: 'string' }},
                                improvements: { type: 'array', items: { type: 'string' }},
                                recommendations: { type: 'array', items: { type: 'string' }},
                            },
                            required: [
                                'score',
                                'overall',
                                'strengths',
                                'improvements',
                                'recommendations'
                            ],
                            additionalProperties: false
                        }
                    }
                }
            });
            const result = JSON.parse(response.output_text);
            return res.json({
                finished: true,
                result: result
            });
        }

        const response = await client.responses.create({
            model: 'gpt-5.6-luna',
            input: `
                You are an AI technical interviewer.
                Position: ${position}
                Candidate level: ${level}
                Interview language: ${language}
                Total questions: ${questions}
                Current question: ${currentQuestion}
                Previous interview history: ${JSON.stringify(history)}
                Current question: ${question}
                Candidate's answer: ${answer}
                Evaluate the candidate's answer.
                Then create the next interview question.

                Rules:
                - Evaluate the answer briefly.
                - Ask only one next question.
                - The next question must be appropriate for the candidate's level.
                - The next question should consider the candidate's previous answers.
                - Do not reveal the correct answer.
                - Use the requested interview language.
                - Return only the next interview question.
            `
        });
        const nextQuestion = response.output_text;
        console.log('Next AI question:', nextQuestion);
        res.json({
            finished: false,
            nextQuestion: nextQuestion
        });
    } catch (error) {
        console.error('AI error:', error);
        res.status(500).json({
            message: 'Failed to process answer'
        });
    }
});

app.listen(PORT, function() {
    console.log(`Server is running at http://localhost:${PORT}`);
});