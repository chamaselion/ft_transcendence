import { useState } from "react";
import { registerUser } from "../api/auth";

function Register() {
	const [form, setForm] = useState({
		login: "",
		email: "",
		password: "",
	});
	const [message, setMessage] = useState("");

	function handleChange(event) {
		setForm({
			...form,
			[event.target.name]: event.target.value,
		});
	}

	async function handleSubmit(event)
	{
		event.preventDefault();
		try {
			const response = await registerUser(form);
			setMessage(`User created: ${response.data.login}`);
			setForm({
				login: "",
				email: "",
				password: "",
			});
		} catch (error){
			console.log(error);
			if (!error.response){
				setMessage("Cannot connect to server");
				return ;
			}
			setMessage(
				`Error ${error.response.status}: ${
					error.response.data?.message || "Unknown error"
				}`
			);
		}
	}
	return (
    <div>
      <h1>Registration</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Login:
            <input
              name="login"
              value={form.login}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Email:
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Password:
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
            />
          </label>
        </div>

        <button type="submit">
          Register
        </button>
      </form>

      <p>{message}</p>
    </div>
  );
}

export default Register;

/* 
текущая цепочка работы регистрации
Поля ввода
    |
    v
form (useState)
    |
    v
handleSubmit()
    |
    v
registerUser(form)
    |
    v
auth.js
    |
    v
POST http://localhost:3001/api/auth/register */





// function Register() {
// 	return (
// 		<div>
// 			<h1>Registration</h1>
// 			<p>Create your account</p>
// 		</div>
// 	)
// }

// export default Register;