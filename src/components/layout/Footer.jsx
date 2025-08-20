import { Facebook, Youtube, Twitter, Instagram } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 px-6 py-10">
      {/* Grid Sections */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8">
        
        {/* About */}
        <div className="col-span-2">
          <h1 className="text-white text-xl font-bold mb-3">Crystal Movies</h1>
          <p className="text-sm leading-relaxed">
            Your ultimate destination for discovering and exploring the world of
            cinema. From blockbusters to indie gems, we've got it all.
          </p>
        </div>

        {/* Social */}
        <div>
          <h6 className="text-white font-semibold mb-3">Follow Us</h6>
          <div className="flex gap-4">
            <Facebook size={22} className="hover:text-blue-500 cursor-pointer" />
            <Youtube size={22} className="hover:text-red-500 cursor-pointer" />
            <Twitter size={22} className="hover:text-sky-400 cursor-pointer" />
            <Instagram size={22} className="hover:text-pink-500 cursor-pointer" />
          </div>
        </div>

        {/* Support */}
        <div>
          <h6 className="text-white font-semibold mb-3">Support</h6>
          <ul className="space-y-2 text-sm">
            <li className="hover:text-white cursor-pointer">Help Center</li>
            <li className="hover:text-white cursor-pointer">Contact Us</li>
            <li className="hover:text-white cursor-pointer">Privacy Policy</li>
            <li className="hover:text-white cursor-pointer">Terms of Service</li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h6 className="text-white font-semibold mb-3">Company</h6>
          <ul className="space-y-2 text-sm">
            <li className="hover:text-white cursor-pointer">About Us</li>
            <li className="hover:text-white cursor-pointer">Careers</li>
            <li className="hover:text-white cursor-pointer">Press</li>
            <li className="hover:text-white cursor-pointer">Blog</li>
          </ul>
        </div>

        {/* Discover */}
        <div>
          <h6 className="text-white font-semibold mb-3">Discover</h6>
          <ul className="space-y-2 text-sm">
            <li className="hover:text-white cursor-pointer">New Releases</li>
            <li className="hover:text-white cursor-pointer">Top Rated</li>
            <li className="hover:text-white cursor-pointer">Trending</li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h6 className="text-white font-semibold mb-3">Contact</h6>
          <p className="text-sm">contact@moviedb.com</p>
          <p className="text-sm">+1 (555) 123-4567</p>
          <p className="text-sm">Nairobi</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-10 border-t border-gray-700 pt-6 text-center text-sm text-gray-400">
        <p>
          &copy; {new Date().getFullYear()} Crystal Movies. All rights reserved. 
          Built with passion for cinema lovers.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
