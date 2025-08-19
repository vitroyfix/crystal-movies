import React from 'react'
import { User } from 'lucide-react';
const Profile = ({name, email}) => {
  return (
      <section>
        <div>
          <User/>
        </div>
        <div>
          {name}
        </div>
        <div>
          {email}
        </div>
        <div>
          <ul>
            <li>Favourites</li>
            <li>My list</li>
          </ul>
        </div>
      </section>
  )
}

export default Profile;