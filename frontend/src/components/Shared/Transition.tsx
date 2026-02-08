import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface TransitionProps {
  children: ReactNode
  direction?: 'left' | 'right'
}

export const Transition = ({ children, direction = 'right' }: TransitionProps) => {
  const variants = {
    enter: {
      x: direction === 'right' ? 300 : -300,
      opacity: 0,
    },
    center: {
      x: 0,
      opacity: 1,
    },
    exit: {
      x: direction === 'left' ? 300 : -300,
      opacity: 0,
    },
  }

  return (
    <motion.div
      initial="enter"
      animate="center"
      exit="exit"
      variants={variants}
      transition={{
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  )
}

export const FadeTransition = ({ children }: { children: ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {children}
    </motion.div>
  )
}


