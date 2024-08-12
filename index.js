document.getElementById('signInForm').addEventListener('submit', signIn);
document.getElementById('logOutBtn').addEventListener('click', logOut);
validateJWT();

/**
 * Validates the JWT token stored in the "token" cookie
 * @returns {Promise<boolean>} True if the JWT is valid, false otherwise
 */
async function validateJWT() {
    const token = getToken();
    if (!token) {
        document.getElementById('signIn').classList.remove('d-none');
        document.getElementById('logOutBtn').disabled = true;
        return false;
    }
    var res;
    try {
        res = await fetch(
            'https://01.kood.tech/api/graphql-engine/v1/graphql',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({
                    query: 'query { user { id } }',
                }),
            }
        );
    } catch (e) {
        document.cookie = document.cookie.split(';').filter((c) => {
            return !c.startsWith('token');
        });
        document.getElementById('errorMsg').classList.remove('d-none');
        document.getElementById('logOutBtn').disabled = true;
        return false;
    }
    const data = await res.json();
    if (data.errors) {
        document.cookie = document.cookie.split(';').filter((c) => {
            return !c.startsWith('token');
        });
        document.getElementById('signIn').classList.remove('d-none');
        document.getElementById('logOutBtn').disabled = true;
        return false;
    }
    document.getElementById('signIn').classList.add('d-none');
    showInfo();
    document.getElementById('logOutBtn').disabled = false;
    return true;
}

/**
 * Logs the user out by removing the token cookie
 */
function logOut() {
    document.cookie = 'token=';
    document.getElementById('signIn').classList.remove('d-none');
    document.getElementById('content').classList.add('d-none');
    document.getElementById('logOutBtn').disabled = true;
}

/**
 * Takes the username and password from the form and sends a request to the server to sign in
 *
 * Sets the token cookie if the request is successful
 * @param {Event} e
 * @returns
 */
async function signIn(e) {
    e.preventDefault();
    if (await validateJWT()) {
        return;
    }
    const username = e.target.username.value;
    const password = e.target.password.value;
    const res = await fetch('https://01.kood.tech/api/auth/signin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + window.btoa(username + ':' + password),
        },
    });
    if (!res.ok) {
        const err = await res.json();
        document.getElementById('msg').innerHTML = err.error;
        document.getElementById('logOutBtn').disabled = true;
        return;
    }
    const data = await res.json();
    document.cookie = `token=${data};`;
    document.getElementById('signIn').classList.add('d-none');
    document.getElementById('logOutBtn').disabled = false;
    showInfo();
}

async function showInfo() {
    const token = getToken();
    document.getElementById('content').classList.remove('d-none');
    const res = await fetch(
        'https://01.kood.tech/api/graphql-engine/v1/graphql',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
            },
            body: JSON.stringify({
                query: 'query {\
                    user {\
                        id\
                        login\
                        attrs\
                        auditRatio\
                        skills: transactions(order_by: [{type: desc}, {amount: desc}] distinct_on: [type] where: {type: {_like: "skill_%"}}) {\
                            type\
                            amount\
                        }\
                        audits {\
                            group {\
                                captainId\
                                captainLogin\
                                path\
                                createdAt\
                                updatedAt\
                                members {\
                                    userId\
                                    userLogin\
                                }\
                            }\
                        }\
                    }\
                    event(where: {path: {_nlike: "%checkpoint%"}}) {\
                        path\
                        id\
                    }\
                    transaction(where: {type: {_eq: "xp"}}, order_by: {createdAt: desc}) {\
                        amount\
                        createdAt\
                        eventId\
                        path\
                    }\
                }',
            }),
        }
    );
    const data = await res.json();
    if (data.errors) {
        console.log(data.errors[0].message);
        return;
    }
    console.log(data.data);
    const event = Object.fromEntries(
        data.data.event.map((e) => [e.id, e.path])
    );
    const skills = Object.fromEntries(
        data.data.user[0].skills.map((s) => [s.type.slice(6), s.amount])
    );
    const transaction = data.data.transaction;
    let total = 0;
    var dates = [];
    let prevDate = new Date(transaction[transaction.length - 1].createdAt)
        .toLocaleString()
        .split(', ')[0];
    transaction.reverse().forEach((t) => {
        const date = new Date(t.createdAt).toLocaleString().split(', ')[0];
        if (date !== prevDate && !t.path.includes('piscine-go')) {
            dates.push(prevDate);
            prevDate = date;
        }
    });
    const xp = {};
    transaction.forEach((t) => {
        if (t.path.includes('piscine-go')) return;
        const date = new Date(t.createdAt).toLocaleString().split(', ')[0];
        xp[date] = Math.floor(t.amount + total);
        total += t.amount;
    });
    const user = data.data.user[0];
    document.getElementById('contentUsername').innerHTML = user.login;
    document.getElementById('contentId').innerHTML = user.id;
    document.getElementById('contentEmail').innerHTML = user.attrs.email;
    document.getElementById('contentFName').innerHTML = user.attrs.firstName;
    document.getElementById('contentLName').innerHTML = user.attrs.lastName;
    console.log(skills);
    const xpGraph = new Chart('xpGraph', {
        type: 'line',
        data: {
            labels: dates.map((d) => d.split(', ')[0]),
            datasets: [
                {
                    label: 'XP',
                    data: Array.from(Object.values(xp)),
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    tension: 0.1,
                },
            ],
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                },
            },
        },
    });
    const skillNames = {
        html: 'HTML',
        css: 'CSS',
        js: 'JS',
        sql: 'SQL',
        go: 'Go',
        unix: 'Unix',
        tcp: 'TCP/IP',
        'sys-admin': 'SysAdmin',
        'front-end': 'Front-End',
        'back-end': 'Back-End',
        docker: 'Docker',
        algo: 'Algorithms',
        prog: 'Elementary Programming',
        game: 'Game',
    };
    for (const [key, value] of Object.entries(skills)) {
        console.log(key, value);
        const skill = document.createElement('div');
        skill.classList.add('skill', 'col-2', 'm-1');
        const heading = document.createElement('h3');
        heading.innerHTML = skillNames[key] ? skillNames[key] : key;
        const skillGraph = document.createElement('canvas');
        skillGraph.id = key;
        document.getElementById('skills').appendChild(skill);
        skill.appendChild(heading);
        skill.appendChild(skillGraph);
        const graph = new Chart(key, {
            type: 'doughnut',
            data: {
                labels: ['XP', 'Total'],
                datasets: [
                    {
                        label: key,
                        data: [value, 100 - value],
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(255, 99, 132, 0.06)',
                        ],
                        borderColor: [
                            'rgba(255, 99, 132, 1)',
                            'rgba(255, 99, 132, 0.5)',
                        ],
                        borderWidth: 1,
                    },
                ],
            },
        });
    }
}

/**
 *   Returns the value of the token cookie
 *
 *   If the cookie is not found, returns undefined
 *   @returns {string | undefined} The value of the token cookie
 */
function getToken() {
    return document.cookie
        .split(';')
        .find((c) => c.startsWith('token'))
        ?.split('=')[1];
}
